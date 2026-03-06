#include "agent_core.h"
#include "tool_call_sdk_bridge.hpp"

#include <atomic>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#include "nlohmann/json.hpp"

namespace {

using json = nlohmann::json;

std::atomic<unsigned long long> g_seq{1};
thread_local std::string g_last_error;
thread_local std::string g_last_output;

struct ToolSpec {
    std::string name;
    std::string description;
    json parameters;
    json constraints;
};

enum class ExecutorKind {
    Mock,
    Builtin,
    Native,
};

struct ToolRegistration {
    ToolSpec spec;
    ExecutorKind executor_kind = ExecutorKind::Mock;
    std::string executor_target;
    json mock_result;
};

struct NormalizedCall {
    std::string provider_kind = "custom";
    std::string tool_name;
    std::string intent;
    std::string provider_call_id;
    json input_raw = json::object();
    json input_normalized = json::object();
};

struct PolicyView {
    json raw_json = json::object();
    std::vector<std::string> allow_tools;
    std::vector<std::string> deny_tools;
    std::string idempotency_key;
};

struct ToolExecutionRequest {
    std::string tool_name;
    std::string provider_kind;
    std::string intent;
    std::string provider_call_id;
    json args = json::object();
    json policy = json::object();
};

struct ToolExecutionResult {
    std::string status = "success";
    json result = json::object();
    json error = nullptr;
    json evidence = json::array();
    std::string handoff = "continue";
};

struct ExecutionRecord {
    std::string execution_id;
    std::string tool_kind = "function";
    std::string provider_kind = "custom";
    std::string intent;
    std::string provider_call_id;
    json input_raw = json::object();
    json input_normalized = json::object();
    json policy_snapshot = json::object();
    std::string status = "failed";
    json evidence = json::array();
    json error = nullptr;
    std::string handoff;
    std::string timestamp;
    json result = json::object();
};

struct RuntimeEventRecord {
    std::string execution_id;
    std::string source = "unknown";
    std::string event_type = "unknown";
    std::string tool_kind = "function";
    json intent = nullptr;
    json input_raw = json::object();
    json input_normalized = json::object();
    json policy_snapshot = json::object();
    std::string status = "partial";
    json evidence = json::array();
    json error = nullptr;
    std::string handoff = "continue_observing";
    std::string timestamp;
};

std::mutex g_tools_mu;
std::unordered_map<std::string, ToolRegistration> g_tools;
std::unordered_map<std::string, ExecutionRecord> g_executions;
std::unordered_map<std::string, std::string> g_idempotency_to_execution;
std::unordered_map<std::string, std::string> g_idempotency_signature;

std::string now_iso8601_utc() {
    using namespace std::chrono;
    const auto now = system_clock::now();
    const auto tt = system_clock::to_time_t(now);
    std::tm tm {};
#if defined(_WIN32)
    gmtime_s(&tm, &tt);
#else
    gmtime_r(&tt, &tm);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

std::string next_id(const std::string &prefix) {
    const auto seq = g_seq.fetch_add(1, std::memory_order_relaxed);
    return prefix + "-" + std::to_string(seq);
}

std::string get_string_or(const json &obj, const char *key, const std::string &fallback = "") {
    if (!obj.is_object() || !obj.contains(key) || !obj.at(key).is_string()) {
        return fallback;
    }
    return obj.at(key).get<std::string>();
}

json get_json_or(const json &obj, const char *key, const json &fallback = json()) {
    if (!obj.is_object() || !obj.contains(key)) {
        return fallback;
    }
    return obj.at(key);
}

std::vector<std::string> json_string_array_to_vector(const json &value) {
    std::vector<std::string> out;
    if (!value.is_array()) {
        return out;
    }
    for (const auto &entry : value) {
        if (entry.is_string()) {
            out.push_back(entry.get<std::string>());
        }
    }
    return out;
}

PolicyView build_policy_view(const json &policy) {
    return PolicyView{
        .raw_json = policy,
        .allow_tools = json_string_array_to_vector(policy.value("allow_tools", json::array())),
        .deny_tools = json_string_array_to_vector(policy.value("deny_tools", json::array())),
        .idempotency_key = policy.value("idempotency_key", "")
    };
}

json serialize_normalized_call(const NormalizedCall &call) {
    return json{
        {"provider_kind", call.provider_kind},
        {"tool_name", call.tool_name},
        {"intent", call.intent},
        {"input_raw", call.input_raw},
        {"input_normalized", call.input_normalized},
        {"provider_call_id", call.provider_call_id}
    };
}

json serialize_execution_record(const ExecutionRecord &record) {
    return json{
        {"execution_id", record.execution_id},
        {"tool_kind", record.tool_kind},
        {"provider_kind", record.provider_kind},
        {"intent", record.intent},
        {"provider_call_id", record.provider_call_id},
        {"input_raw", record.input_raw},
        {"input_normalized", record.input_normalized},
        {"policy_snapshot", record.policy_snapshot},
        {"status", record.status},
        {"evidence", record.evidence},
        {"error", record.error},
        {"handoff", record.handoff},
        {"timestamp", record.timestamp},
        {"result", record.result}
    };
}

ExecutionRecord deserialize_execution_record(const json &obj) {
    ExecutionRecord record;
    record.execution_id = get_string_or(obj, "execution_id");
    record.tool_kind = get_string_or(obj, "tool_kind", "function");
    record.provider_kind = get_string_or(obj, "provider_kind", "custom");
    record.intent = get_string_or(obj, "intent");
    record.provider_call_id = get_string_or(obj, "provider_call_id");
    record.input_raw = get_json_or(obj, "input_raw", json::object());
    record.input_normalized = get_json_or(obj, "input_normalized", json::object());
    record.policy_snapshot = get_json_or(obj, "policy_snapshot", json::object());
    record.status = get_string_or(obj, "status", "failed");
    record.evidence = get_json_or(obj, "evidence", json::array());
    record.error = get_json_or(obj, "error", nullptr);
    record.handoff = get_string_or(obj, "handoff");
    record.timestamp = get_string_or(obj, "timestamp");
    record.result = get_json_or(obj, "result", json::object());
    return record;
}

json serialize_runtime_event_record(const RuntimeEventRecord &record) {
    return json{
        {"execution_id", record.execution_id},
        {"source", record.source},
        {"event_type", record.event_type},
        {"tool_kind", record.tool_kind},
        {"intent", record.intent},
        {"input_raw", record.input_raw},
        {"input_normalized", record.input_normalized},
        {"policy_snapshot", record.policy_snapshot},
        {"status", record.status},
        {"evidence", record.evidence},
        {"error", record.error},
        {"handoff", record.handoff},
        {"timestamp", record.timestamp}
    };
}

std::string get_status_from_codex_item(const std::string &event_type, const json &item) {
    if (event_type == "item.started") {
        return "running";
    }
    if (event_type == "item.updated") {
        return "running";
    }

    const std::string item_status = get_string_or(item, "status");
    if (item_status == "completed") {
        return "success";
    }
    if (item_status == "failed") {
        return "failed";
    }
    if (item_status == "declined") {
        return "blocked";
    }
    if (item_status == "in_progress") {
        return "running";
    }
    if (event_type == "item.completed") {
        return "success";
    }
    return "partial";
}

std::string codex_tool_kind(const std::string &item_type) {
    if (item_type == "command_execution") {
        return "shell";
    }
    if (item_type == "web_search") {
        return "web";
    }
    if (item_type == "mcp_tool_call") {
        return "mcp";
    }
    if (item_type == "file_change") {
        return "code";
    }
    if (item_type == "todo_list") {
        return "skills";
    }
    if (item_type == "reasoning" || item_type == "agent_message") {
        return "function";
    }
    return "function";
}

std::string claude_tool_kind(const std::string &tool_name) {
    if (tool_name.rfind("Bash", 0) == 0) {
        return "shell";
    }
    if (tool_name.rfind("WebFetch", 0) == 0 || tool_name.rfind("WebSearch", 0) == 0) {
        return "web";
    }
    if (tool_name.rfind("MCP", 0) == 0 || tool_name.rfind("mcp", 0) == 0) {
        return "mcp";
    }
    if (tool_name.rfind("Task", 0) == 0 || tool_name.rfind("Agent", 0) == 0) {
        return "skills";
    }
    return "function";
}

std::string default_handoff(const std::string &status) {
    if (status == "failed" || status == "blocked" || status == "timeout") {
        return "retry_or_manual_takeover";
    }
    if (status == "running" || status == "partial" || status == "queued") {
        return "continue_observing";
    }
    return "continue";
}

bool validate_type(const json &value, const std::string &expected) {
    if (expected == "string") return value.is_string();
    if (expected == "number") return value.is_number();
    if (expected == "integer") return value.is_number_integer();
    if (expected == "boolean") return value.is_boolean();
    if (expected == "array") return value.is_array();
    if (expected == "object") return value.is_object();
    return true;
}

json schema_validate_args(const json &args, const json &schema) {
    if (!schema.is_object()) {
        return json::object();
    }
    if (!args.is_object()) {
        return json{
            {"error_code", "E_SCHEMA"},
            {"message", "tool arguments must be a JSON object"}
        };
    }

    const json required = schema.value("required", json::array());
    const json properties = schema.value("properties", json::object());
    const bool additional = schema.value("additionalProperties", true);

    if (required.is_array()) {
        for (const auto &entry : required) {
            if (entry.is_string()) {
                const std::string key = entry.get<std::string>();
                if (!args.contains(key)) {
                    return json{
                        {"error_code", "E_SCHEMA"},
                        {"message", "missing required argument"},
                        {"detail", json{{"missing", key}}}
                    };
                }
            }
        }
    }

    if (properties.is_object()) {
        for (auto it = args.begin(); it != args.end(); ++it) {
            const std::string key = it.key();
            if (!properties.contains(key)) {
                if (!additional) {
                    return json{
                        {"error_code", "E_SCHEMA"},
                        {"message", "unknown argument is not allowed"},
                        {"detail", json{{"key", key}}}
                    };
                }
                continue;
            }
            const json prop = properties.at(key);
            const std::string expected = prop.value("type", "");
            if (!expected.empty() && !validate_type(it.value(), expected)) {
                return json{
                    {"error_code", "E_SCHEMA"},
                    {"message", "argument type mismatch"},
                    {"detail", json{{"key", key}, {"expected", expected}}}
                };
            }
        }
    }

    return json::object();
}

json parse_policy_json(const char *policy_json, json *err_out) {
    if (err_out != nullptr) {
        *err_out = nullptr;
    }
    if (policy_json == nullptr) {
        return json::object();
    }

    try {
        const json parsed = json::parse(policy_json);
        if (!parsed.is_object()) {
            if (err_out != nullptr) {
                *err_out = json{
                    {"error_code", "E_POLICY_PARSE"},
                    {"message", "policy_json must be a JSON object"}
                };
            }
            return json::object();
        }
        return parsed;
    } catch (const std::exception &e) {
        if (err_out != nullptr) {
            *err_out = json{
                {"error_code", "E_POLICY_PARSE"},
                {"message", "invalid policy_json"},
                {"detail", e.what()}
            };
        }
        return json::object();
    }
}

bool fail_function_call(const json &err, const std::string &status = "failed", const std::string &tool_name = "") {
    g_last_error = err.dump();
    json out{
        {"status", status},
        {"error", err}
    };
    if (!tool_name.empty()) {
        out["tool_name"] = tool_name;
    }
    g_last_output = out.dump();
    return false;
}

bool parse_model_output_json(const char *model_output_json, json *raw_out) {
    try {
        *raw_out = json::parse(model_output_json);
        return true;
    } catch (const std::exception &e) {
        const json err{
            {"error_code", "E_PARSE"},
            {"message", "invalid model_output_json"},
            {"detail", e.what()}
        };
        return fail_function_call(err);
    }
}

bool parse_tool_registration_json(const char *tool_definition_json, ToolRegistration *tool_out) {
    const json raw = json::parse(tool_definition_json);
    const std::string name = get_string_or(raw, "name");
    if (name.empty()) {
        g_last_error = R"({"error_code":"E_TOOL_DEF","message":"tool definition requires non-empty name"})";
        return false;
    }

    const json constraints = raw.value("constraints", json::object());
    ExecutorKind executor_kind = ExecutorKind::Mock;
    std::string executor_target;

    if (constraints.is_object() && constraints.contains("executor_kind")) {
        if (!constraints.at("executor_kind").is_string()) {
            g_last_error = json{
                {"error_code", "E_TOOL_DEF"},
                {"message", "constraints.executor_kind must be a string"}
            }.dump();
            return false;
        }

        const std::string executor_kind_raw = constraints.at("executor_kind").get<std::string>();
        if (executor_kind_raw == "mock") {
            executor_kind = ExecutorKind::Mock;
        } else if (executor_kind_raw == "builtin") {
            executor_kind = ExecutorKind::Builtin;
        } else if (executor_kind_raw == "native") {
            executor_kind = ExecutorKind::Native;
        } else {
            g_last_error = json{
                {"error_code", "E_TOOL_DEF"},
                {"message", "unsupported executor_kind"},
                {"detail", json{{"executor_kind", executor_kind_raw}}}
            }.dump();
            return false;
        }
    }

    if (constraints.is_object() && constraints.contains("executor_target")) {
        if (!constraints.at("executor_target").is_string()) {
            g_last_error = json{
                {"error_code", "E_TOOL_DEF"},
                {"message", "constraints.executor_target must be a string"}
            }.dump();
            return false;
        }
        executor_target = constraints.at("executor_target").get<std::string>();
    }

    *tool_out = ToolRegistration{
        .spec = ToolSpec{
            .name = name,
            .description = get_string_or(raw, "description"),
            .parameters = raw.value("parameters", json::object()),
            .constraints = constraints,
        },
        .executor_kind = executor_kind,
        .executor_target = executor_target,
        .mock_result = raw.value("mock_result", json::object()),
    };
    return true;
}

bool normalize_function_call_payload(const json &raw, NormalizedCall *call_out, json *err_out) {
    *err_out = nullptr;

    // OpenAI Responses function_call
    if (raw.is_object() && get_string_or(raw, "type") == "function_call") {
        json args = json::object();
        if (raw.contains("arguments")) {
            if (raw.at("arguments").is_string()) {
                args = json::parse(raw.at("arguments").get<std::string>(), nullptr, false);
                if (args.is_discarded()) {
                    *err_out = json{
                        {"error_code", "E_PARSE"},
                        {"message", "function_call.arguments is not valid JSON"}
                    };
                    return false;
                }
            } else if (raw.at("arguments").is_object()) {
                args = raw.at("arguments");
            }
        }

        *call_out = NormalizedCall{
            .provider_kind = "openai",
            .tool_name = get_string_or(raw, "name"),
            .intent = get_string_or(raw, "intent", "function_call"),
            .provider_call_id = get_string_or(raw, "call_id"),
            .input_raw = raw,
            .input_normalized = args
        };
        return true;
    }

    // Anthropic tool_use
    if (raw.is_object() && get_string_or(raw, "type") == "tool_use") {
        *call_out = NormalizedCall{
            .provider_kind = "claude",
            .tool_name = get_string_or(raw, "name"),
            .intent = get_string_or(raw, "intent", "tool_use"),
            .provider_call_id = get_string_or(raw, "id"),
            .input_raw = raw,
            .input_normalized = raw.value("input", json::object())
        };
        return true;
    }

    // Generic custom call
    if (raw.is_object() && raw.contains("tool")) {
        *call_out = NormalizedCall{
            .provider_kind = "custom",
            .tool_name = get_string_or(raw, "tool"),
            .intent = get_string_or(raw, "intent", "custom_tool"),
            .provider_call_id = get_string_or(raw, "call_id"),
            .input_raw = raw,
            .input_normalized = raw.value("arguments", json::object())
        };
        return true;
    }

    *err_out = json{
        {"error_code", "E_PARSE"},
        {"message", "unsupported function/custom tool payload"}
    };
    return false;
}

bool prepare_function_call_request(
    const char *model_output_json,
    const char *policy_json,
    PolicyView *policy_out,
    NormalizedCall *normalized_out
) {
    json raw;
    if (!parse_model_output_json(model_output_json, &raw)) {
        return false;
    }

    json policy_err;
    const json policy_json_obj = parse_policy_json(policy_json, &policy_err);
    if (!policy_err.is_null()) {
        return fail_function_call(policy_err);
    }
    *policy_out = build_policy_view(policy_json_obj);

    json normalize_err;
    if (!normalize_function_call_payload(raw, normalized_out, &normalize_err)) {
        return fail_function_call(normalize_err);
    }

    if (normalized_out->tool_name.empty()) {
        return fail_function_call(json{
            {"error_code", "E_PARSE"},
            {"message", "normalized tool_name is empty"}
        });
    }

    return true;
}

bool json_string_array_contains(const json &value, const std::string &target) {
    if (!value.is_array()) {
        return false;
    }
    for (const auto &entry : value) {
        if (entry.is_string() && entry.get<std::string>() == target) {
            return true;
        }
    }
    return false;
}

bool string_list_contains(const std::vector<std::string> &values, const std::string &target) {
    for (const auto &value : values) {
        if (value == target) {
            return true;
        }
    }
    return false;
}

const ToolRegistration *find_registered_tool(const std::string &tool_name) {
    if (tool_name.empty() || !g_tools.contains(tool_name)) {
        return nullptr;
    }
    return &g_tools.at(tool_name);
}

const ToolRegistration *lookup_registered_tool(const std::string &tool_name) {
    const ToolRegistration *tool = find_registered_tool(tool_name);
    if (tool != nullptr) {
        return tool;
    }

    fail_function_call(json{
        {"error_code", "E_TOOL_NOT_FOUND"},
        {"message", "tool is not registered"},
        {"detail", json{{"tool", tool_name}}}
    }, "failed", tool_name);
    return nullptr;
}

bool validate_tool_call_request(
    const ToolRegistration &tool,
    const NormalizedCall &call,
    const PolicyView &policy
) {
    const json schema_err = schema_validate_args(call.input_normalized, tool.spec.parameters);
    if (!schema_err.empty()) {
        return fail_function_call(schema_err, "failed", call.tool_name);
    }

    if (string_list_contains(policy.deny_tools, call.tool_name)) {
        return fail_function_call(json{
            {"error_code", "E_POLICY_DENY"},
            {"message", "tool denied by policy"},
            {"detail", json{{"tool", call.tool_name}}}
        }, "blocked", call.tool_name);
    }

    if (!policy.allow_tools.empty() && !string_list_contains(policy.allow_tools, call.tool_name)) {
        return fail_function_call(json{
            {"error_code", "E_POLICY_DENY"},
            {"message", "tool not in allow_tools"},
            {"detail", json{{"tool", call.tool_name}}}
        }, "blocked", call.tool_name);
    }

    return true;
}

json resolve_mock_result(const ToolRegistration &tool, const json &args) {
    if (tool.mock_result.is_object() && !tool.mock_result.empty()) {
        return tool.mock_result;
    }
    return json{{"ok", true}, {"echo", args}};
}

ToolExecutionResult execute_mock_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    return ToolExecutionResult{
        .status = "success",
        .result = resolve_mock_result(tool, request.args),
        .error = nullptr,
        .evidence = json::array(),
        .handoff = "continue"
    };
}

std::string resolve_executor_target(const ToolRegistration &tool) {
    if (!tool.executor_target.empty()) {
        return tool.executor_target;
    }
    return tool.spec.name;
}

using BuiltinExecutorFn = ToolExecutionResult (*)(const ToolRegistration &, const ToolExecutionRequest &);

ToolExecutionResult execute_builtin_echo(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    return ToolExecutionResult{
        .status = "success",
        .result = json{{"ok", true}, {"echo", request.args}},
        .error = nullptr,
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "continue"
    };
}

const std::unordered_map<std::string, BuiltinExecutorFn> &builtin_executor_registry() {
    static const std::unordered_map<std::string, BuiltinExecutorFn> kRegistry = {
        {"builtin.echo", &execute_builtin_echo},
    };
    return kRegistry;
}

ToolExecutionResult execute_builtin_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    const auto &registry = builtin_executor_registry();
    if (registry.contains(executor_target)) {
        return registry.at(executor_target)(tool, request);
    }

    return ToolExecutionResult{
        .status = "failed",
        .result = json::object(),
        .error = json{
            {"error_code", "E_EXECUTOR_NOT_FOUND"},
            {"message", "builtin executor is not registered"},
            {"detail", json{{"executor_target", executor_target}}}
        },
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "manual_takeover"
    };
}

ToolExecutionResult execute_native_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    (void)request;
    const std::string executor_target = resolve_executor_target(tool);
    return ToolExecutionResult{
        .status = "blocked",
        .result = json::object(),
        .error = json{
            {"error_code", "E_NATIVE_EXECUTOR_UNAVAILABLE"},
            {"message", "native executor is not available in this build"},
            {"detail", json{{"executor_target", executor_target}}}
        },
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "native"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "manual_takeover"
    };
}

ToolExecutionResult execute_tool_registration(
    const ToolRegistration &tool,
    const ToolExecutionRequest &request
) {
    switch (tool.executor_kind) {
        case ExecutorKind::Builtin:
            return execute_builtin_tool(tool, request);
        case ExecutorKind::Native:
            return execute_native_tool(tool, request);
        case ExecutorKind::Mock:
        default:
            return execute_mock_tool(tool, request);
    }
}

std::string build_idempotency_signature(const NormalizedCall &call) {
    return call.provider_kind + "|" + call.tool_name + "|" + call.input_normalized.dump();
}

bool handle_idempotency_replay_locked(
    const PolicyView &policy,
    const NormalizedCall &call,
    std::string *idempotency_key_out,
    std::string *idempotency_signature_out
) {
    *idempotency_key_out = policy.idempotency_key;
    *idempotency_signature_out = build_idempotency_signature(call);

    if (idempotency_key_out->empty() || !g_idempotency_to_execution.contains(*idempotency_key_out)) {
        return false;
    }

    if (g_idempotency_signature.contains(*idempotency_key_out) &&
        g_idempotency_signature.at(*idempotency_key_out) != *idempotency_signature_out) {
        fail_function_call(json{
            {"error_code", "E_IDEMPOTENCY_CONFLICT"},
            {"message", "idempotency_key reused with different provider/tool/arguments"},
            {"detail", json{{"idempotency_key", *idempotency_key_out}}}
        });
        return true;
    }

    const std::string exec_id = g_idempotency_to_execution.at(*idempotency_key_out);
    if (g_executions.contains(exec_id)) {
        json replay = serialize_execution_record(g_executions.at(exec_id));
        replay["handoff"] = "idempotency-hit: reuse previous execution";
        g_last_output = replay.dump();
        return true;
    }

    return false;
}

ToolExecutionRequest build_tool_execution_request(
    const NormalizedCall &call,
    const PolicyView &policy
) {
    return ToolExecutionRequest{
        .tool_name = call.tool_name,
        .provider_kind = call.provider_kind,
        .intent = call.intent,
        .provider_call_id = call.provider_call_id,
        .args = call.input_normalized,
        .policy = policy.raw_json
    };
}

ExecutionRecord build_execution_record(
    const NormalizedCall &call,
    const PolicyView &policy,
    const ToolExecutionResult &execution
) {
    json evidence = json::array({
        json{{"kind", "runtime_event"}, {"value", "tool_executed"}},
        json{{"kind", "provider_kind"}, {"value", call.provider_kind}},
        json{{"kind", "provider_call_id"}, {"value", call.provider_call_id}},
        json{{"kind", "timestamp"}, {"value", now_iso8601_utc()}}
    });
    if (execution.evidence.is_array()) {
        for (const auto &item : execution.evidence) {
            evidence.push_back(item);
        }
    }

    return ExecutionRecord{
        .execution_id = next_id("exec"),
        .tool_kind = "function",
        .provider_kind = call.provider_kind,
        .intent = call.intent,
        .provider_call_id = call.provider_call_id,
        .input_raw = call.input_raw,
        .input_normalized = call.input_normalized,
        .policy_snapshot = policy.raw_json,
        .status = execution.status,
        .evidence = evidence,
        .error = execution.error,
        .handoff = execution.handoff,
        .timestamp = now_iso8601_utc(),
        .result = execution.result
    };
}

void store_execution_record_locked(
    const ExecutionRecord &record,
    const std::string &idempotency_key,
    const std::string &idempotency_signature
) {
    const std::string execution_id = record.execution_id;
    g_executions[execution_id] = record;
    if (!idempotency_key.empty()) {
        g_idempotency_to_execution[idempotency_key] = execution_id;
        g_idempotency_signature[idempotency_key] = idempotency_signature;
    }
    g_last_output = serialize_execution_record(record).dump();
}

bool execute_prepared_function_call_locked(const PolicyView &policy, const NormalizedCall &call) {
    std::string idem;
    std::string idem_signature;
    if (handle_idempotency_replay_locked(policy, call, &idem, &idem_signature)) {
        return true;
    }

    const ToolRegistration *tool = lookup_registered_tool(call.tool_name);
    if (tool == nullptr) {
        return true;
    }

    if (!validate_tool_call_request(*tool, call, policy)) {
        return true;
    }

    const ToolExecutionRequest request = build_tool_execution_request(call, policy);
    const ToolExecutionResult execution = execute_tool_registration(*tool, request);
    ExecutionRecord record = build_execution_record(call, policy, execution);
    store_execution_record_locked(record, idem, idem_signature);
    return true;
}

json parse_optional_object_json(const char *json_text) {
    if (json_text == nullptr) {
        return json::object();
    }
    const json parsed = json::parse(json_text, nullptr, false);
    return parsed.is_object() ? parsed : json::object();
}

void load_registered_tool_metadata(
    const std::string &tool_name,
    std::string *tool_description_out,
    json *tool_parameters_out,
    json *tool_constraints_out
) {
    *tool_description_out = "";
    *tool_parameters_out = json::object();
    *tool_constraints_out = json::object();

    std::lock_guard<std::mutex> lk(g_tools_mu);
    const ToolRegistration *tool = find_registered_tool(tool_name);
    if (tool != nullptr) {
        *tool_description_out = tool->spec.description;
        *tool_parameters_out = tool->spec.parameters;
        *tool_constraints_out = tool->spec.constraints;
    }
}

json build_provider_execution_wrapper(
    const json &record,
    const json &provider_payload,
    const json &sdk_bundle
) {
    return json{
        {"execution", record},
        {"provider_payload", provider_payload},
        {"sdk", sdk_bundle}
    };
}

std::string extract_provider_call_id(const json &record) {
    if (record.is_object() && record.contains("provider_call_id") && record.at("provider_call_id").is_string()) {
        return record.at("provider_call_id").get<std::string>();
    }
    if (record.is_object() && record.contains("evidence") && record.at("evidence").is_array()) {
        for (const auto &ev : record.at("evidence")) {
            if (!ev.is_object()) continue;
            if (ev.value("kind", "") == "provider_call_id" && ev.contains("value") && ev.at("value").is_string()) {
                return ev.at("value").get<std::string>();
            }
        }
    }
    return "";
}

std::string extract_provider_call_id(const ExecutionRecord &record) {
    if (!record.provider_call_id.empty()) {
        return record.provider_call_id;
    }
    if (record.evidence.is_array()) {
        for (const auto &ev : record.evidence) {
            if (!ev.is_object()) continue;
            if (ev.value("kind", "") == "provider_call_id" && ev.contains("value") && ev.at("value").is_string()) {
                return ev.at("value").get<std::string>();
            }
        }
    }
    return "";
}

std::string extract_tool_name_from_record(const json &record) {
    if (record.is_object() && record.contains("input_raw") && record.at("input_raw").is_object()) {
        const json &raw = record.at("input_raw");
        const auto name = get_string_or(raw, "name");
        if (!name.empty()) {
            return name;
        }
        const auto tool = get_string_or(raw, "tool");
        if (!tool.empty()) {
            return tool;
        }
    }
    return "";
}

std::string extract_tool_name_from_record(const ExecutionRecord &record) {
    if (record.input_raw.is_object()) {
        const auto name = get_string_or(record.input_raw, "name");
        if (!name.empty()) {
            return name;
        }
        const auto tool = get_string_or(record.input_raw, "tool");
        if (!tool.empty()) {
            return tool;
        }
    }
    return "";
}

json build_openai_function_call_output_payload(const json &record, const std::string &call_id_override) {
    const std::string status = record.value("status", "failed");
    const bool success = (status == "success");
    const std::string call_id = call_id_override.empty() ? extract_provider_call_id(record) : call_id_override;

    json output_body;
    if (success) {
        output_body = record.value("result", json::object());
    } else {
        output_body = json{
            {"status", status},
            {"error", record.value("error", json::object())}
        };
    }

    return json{
        {"type", "function_call_output"},
        {"call_id", call_id},
        {"output", output_body}
    };
}

json build_openai_function_call_output_payload(const ExecutionRecord &record, const std::string &call_id_override) {
    const bool success = (record.status == "success");
    const std::string call_id = call_id_override.empty() ? extract_provider_call_id(record) : call_id_override;

    json output_body;
    if (success) {
        output_body = record.result;
    } else {
        output_body = json{
            {"status", record.status},
            {"error", record.error}
        };
    }

    return json{
        {"type", "function_call_output"},
        {"call_id", call_id},
        {"output", output_body}
    };
}

json build_claude_tool_result_payload(const json &record, const std::string &tool_use_id_override) {
    const std::string status = record.value("status", "failed");
    const bool success = (status == "success");
    const std::string tool_use_id = tool_use_id_override.empty() ? extract_provider_call_id(record) : tool_use_id_override;

    const json body = success
        ? record.value("result", json::object())
        : json{{"status", status}, {"error", record.value("error", json::object())}};

    return json{
        {"type", "tool_result"},
        {"tool_use_id", tool_use_id},
        {"is_error", !success},
        {"content", json::array({
            json{
                {"type", "text"},
                {"text", body.dump()}
            }
        })}
    };
}

json build_claude_tool_result_payload(const ExecutionRecord &record, const std::string &tool_use_id_override) {
    const bool success = (record.status == "success");
    const std::string tool_use_id = tool_use_id_override.empty() ? extract_provider_call_id(record) : tool_use_id_override;

    const json body = success
        ? record.result
        : json{{"status", record.status}, {"error", record.error}};

    return json{
        {"type", "tool_result"},
        {"tool_use_id", tool_use_id},
        {"is_error", !success},
        {"content", json::array({
            json{
                {"type", "text"},
                {"text", body.dump()}
            }
        })}
    };
}

RuntimeEventRecord base_runtime_record(const json &raw) {
    return RuntimeEventRecord{
        .execution_id = "",
        .source = "unknown",
        .event_type = "unknown",
        .tool_kind = "function",
        .intent = nullptr,
        .input_raw = raw,
        .input_normalized = json::object(),
        .policy_snapshot = json::object(),
        .status = "partial",
        .evidence = json::array(),
        .error = nullptr,
        .handoff = "continue_observing",
        .timestamp = now_iso8601_utc()
    };
}

RuntimeEventRecord normalize_codex(const json &raw) {
    RuntimeEventRecord out = base_runtime_record(raw);
    const std::string event_type = get_string_or(raw, "type", "unknown");

    out.source = "codex_cli";
    out.event_type = event_type;
    out.execution_id = next_id("codex");

    if (event_type == "turn.started") {
        out.status = "running";
        out.intent = "turn_start";
    } else if (event_type == "turn.completed") {
        out.status = "success";
        out.intent = "turn_complete";
        if (raw.contains("usage")) {
            out.evidence.push_back(json{{"usage", raw.at("usage")}});
        }
    } else if (event_type == "turn.failed") {
        out.status = "failed";
        out.intent = "turn_failed";
        if (raw.contains("error")) {
            out.error = raw.at("error");
        }
    } else if (event_type == "error") {
        out.status = "failed";
        out.intent = "stream_error";
        out.error = raw;
    } else if (event_type == "item.started" || event_type == "item.updated" || event_type == "item.completed") {
        const json item = raw.value("item", json::object());
        const std::string item_id = get_string_or(item, "id", next_id("item"));
        const std::string item_type = get_string_or(item, "type", "unknown");

        out.execution_id = item_id;
        out.tool_kind = codex_tool_kind(item_type);
        out.intent = item_type;
        out.input_raw = item;
        out.status = get_status_from_codex_item(event_type, item);

        if (item_type == "command_execution") {
            out.input_normalized = json{{"command", item.value("command", "")}};
            out.evidence.push_back(json{
                {"aggregated_output", item.value("aggregated_output", "")},
                {"exit_code", get_json_or(item, "exit_code", nullptr)}
            });
        } else if (item_type == "mcp_tool_call") {
            out.input_normalized = json{
                {"server", item.value("server", "")},
                {"tool", item.value("tool", "")},
                {"arguments", item.value("arguments", json::object())}
            };
            if (item.contains("result")) {
                out.evidence.push_back(json{{"result", item.at("result")}});
            }
            if (item.contains("error") && !item.at("error").is_null()) {
                out.error = item.at("error");
            }
        } else if (item_type == "web_search") {
            out.input_normalized = json{
                {"query", item.value("query", "")},
                {"action", item.value("action", "")}
            };
        } else if (item_type == "file_change") {
            out.input_normalized = json{{"changes", item.value("changes", json::array())}};
            out.evidence.push_back(json{{"changes", item.value("changes", json::array())}});
        } else {
            out.input_normalized = item;
        }
    } else if (event_type == "thread.started") {
        out.status = "success";
        out.intent = "thread_start";
        out.execution_id = raw.value("thread_id", next_id("thread"));
    }

    out.handoff = default_handoff(out.status);
    return out;
}

RuntimeEventRecord normalize_claude(const json &raw) {
    RuntimeEventRecord out = base_runtime_record(raw);
    const std::string event_type = get_string_or(raw, "type", "unknown");

    out.source = "claude_code";
    out.event_type = event_type;
    out.execution_id = get_string_or(raw, "uuid", next_id("claude"));

    if (raw.contains("session_id")) {
        out.policy_snapshot["session_id"] = raw.at("session_id");
    }

    if (event_type == "control_request") {
        const json request = raw.value("request", json::object());
        const std::string subtype = get_string_or(request, "subtype", "unknown");
        out.event_type = "control_request." + subtype;
        out.execution_id = request.value("tool_use_id", next_id("claude-tool"));
        out.status = "blocked";
        out.intent = subtype;
        out.input_raw = request;

        if (subtype == "can_use_tool") {
            const std::string tool_name = request.value("tool_name", "");
            out.tool_kind = claude_tool_kind(tool_name);
            out.input_normalized = json{
                {"tool_name", tool_name},
                {"input", request.value("input", json::object())}
            };
            if (request.contains("decision_reason")) {
                out.evidence.push_back(json{{"decision_reason", request.at("decision_reason")}});
            }
            if (request.contains("blocked_path")) {
                out.evidence.push_back(json{{"blocked_path", request.at("blocked_path")}});
            }
            out.handoff = "await_permission";
            return out;
        }

        out.input_normalized = request;
        out.handoff = "continue_observing";
        return out;
    }

    if (event_type == "result") {
        const std::string subtype = get_string_or(raw, "subtype", "unknown");
        out.event_type = "result." + subtype;
        out.intent = "turn_result";
        out.tool_kind = "function";
        out.status = (subtype == "success") ? "success" : "failed";
        out.input_normalized = json{
            {"stop_reason", get_json_or(raw, "stop_reason", nullptr)},
            {"num_turns", raw.value("num_turns", 0)},
            {"usage", raw.value("usage", json::object())}
        };
        out.evidence.push_back(json{
            {"duration_ms", raw.value("duration_ms", 0)},
            {"duration_api_ms", raw.value("duration_api_ms", 0)},
            {"total_cost_usd", raw.value("total_cost_usd", 0.0)}
        });

        if (subtype != "success") {
            out.error = json{
                {"subtype", subtype},
                {"errors", raw.value("errors", json::array())}
            };
        }
    } else if (event_type == "assistant") {
        out.status = "success";
        out.intent = "assistant_message";
        out.input_normalized = json{{"message", raw.value("message", json::object())}};
    } else if (event_type == "stream_event") {
        out.status = "running";
        out.intent = "partial_stream";
        out.input_normalized = json{{"event", raw.value("event", json::object())}};
    } else if (event_type == "system") {
        const std::string subtype = get_string_or(raw, "subtype", "unknown");
        out.event_type = "system." + subtype;
        out.intent = subtype;
        out.tool_kind = (subtype.rfind("hook_", 0) == 0) ? "hooks" : "function";
        out.status = "running";
        out.input_normalized = raw;

        if (subtype == "hook_response") {
            const std::string outcome = get_string_or(raw, "outcome", "success");
            if (outcome == "error" || outcome == "cancelled") {
                out.status = "failed";
                out.error = json{{"outcome", outcome}};
            } else {
                out.status = "success";
            }
        }
    } else {
        out.intent = event_type;
        out.status = "partial";
        out.input_normalized = raw;
    }

    out.handoff = default_handoff(out.status);
    return out;
}

RuntimeEventRecord normalize_unknown(const json &raw) {
    RuntimeEventRecord out = base_runtime_record(raw);
    out.execution_id = next_id("unknown");
    out.status = "partial";
    out.intent = "unknown_event";
    out.handoff = "manual_classification";
    return out;
}

RuntimeEventRecord normalize_runtime_event(const json &raw) {
    const std::string type = get_string_or(raw, "type", "unknown");
    if (type.rfind("thread.", 0) == 0 || type.rfind("turn.", 0) == 0 || type.rfind("item.", 0) == 0 || type == "error") {
        return normalize_codex(raw);
    }
    if (raw.contains("session_id") || type == "control_request" || type == "result" || type == "assistant" || type == "stream_event" || type == "system") {
        return normalize_claude(raw);
    }
    return normalize_unknown(raw);
}

} // namespace

int agent_core_init(void) {
    std::lock_guard<std::mutex> lk(g_tools_mu);
    g_tools.clear();
    g_executions.clear();
    g_idempotency_to_execution.clear();
    g_idempotency_signature.clear();
    return 0;
}

void agent_core_shutdown(void) {
    std::lock_guard<std::mutex> lk(g_tools_mu);
    g_tools.clear();
    g_executions.clear();
    g_idempotency_to_execution.clear();
    g_idempotency_signature.clear();
}

const char *agent_core_version(void) {
    return "0.2.0";
}

int agent_core_register_tool(const char *tool_definition_json) {
    g_last_error.clear();
    if (tool_definition_json == nullptr) {
        g_last_error = R"({"error_code":"E_INPUT","message":"tool_definition_json is null"})";
        return 1;
    }

    try {
        ToolRegistration tool;
        if (!parse_tool_registration_json(tool_definition_json, &tool)) {
            return 2;
        }

        std::lock_guard<std::mutex> lk(g_tools_mu);
        g_tools[tool.spec.name] = std::move(tool);
        return 0;
    } catch (const std::exception &e) {
        g_last_error = json{
            {"error_code", "E_PARSE"},
            {"message", "invalid tool definition json"},
            {"detail", e.what()}
        }.dump();
        return 3;
    }
}

const char *agent_core_execute_function_call(const char *model_output_json, const char *policy_json) {
    g_last_error.clear();
    g_last_output.clear();

    if (model_output_json == nullptr) {
        g_last_output = json{
            {"status", "failed"},
            {"error", json{{"error_code", "E_INPUT"}, {"message", "model_output_json is null"}}}
        }.dump();
        return g_last_output.c_str();
    }

    try {
        PolicyView policy;
        NormalizedCall normalized;
        if (!prepare_function_call_request(model_output_json, policy_json, &policy, &normalized)) {
            return g_last_output.c_str();
        }

        std::lock_guard<std::mutex> lk(g_tools_mu);
        execute_prepared_function_call_locked(policy, normalized);
        return g_last_output.c_str();
    } catch (const std::exception &e) {
        fail_function_call(json{
            {"error_code", "E_PARSE"},
            {"message", "invalid model_output_json"},
            {"detail", e.what()}
        });
        return g_last_output.c_str();
    }
}

const char *agent_core_execute_openai_function_call(const char *openai_function_call_json, const char *policy_json) {
    const char *record_str = agent_core_execute_function_call(openai_function_call_json, policy_json);
    try {
        const json record_json = json::parse(record_str == nullptr ? "{}" : record_str);
        const ExecutionRecord record = deserialize_execution_record(record_json);
        const json policy = parse_optional_object_json(policy_json);
        const std::string tool_name = extract_tool_name_from_record(record);

        std::string tool_description;
        json tool_parameters = json::object();
        json tool_constraints = json::object();
        load_registered_tool_metadata(
            tool_name,
            &tool_description,
            &tool_parameters,
            &tool_constraints
        );

        const json sdk_bundle = better_agent::sdk_bridge::build_openai_bundle(
            tool_name,
            tool_description,
            tool_parameters,
            tool_constraints,
            record.input_normalized,
            policy,
            extract_provider_call_id(record)
        );

        json out = build_provider_execution_wrapper(
            record_json,
            build_openai_function_call_output_payload(record, ""),
            sdk_bundle
        );
        g_last_output = out.dump();
        return g_last_output.c_str();
    } catch (...) {
        return record_str;
    }
}

const char *agent_core_execute_claude_tool_use(const char *claude_tool_use_json, const char *policy_json) {
    const char *record_str = agent_core_execute_function_call(claude_tool_use_json, policy_json);
    try {
        const json record_json = json::parse(record_str == nullptr ? "{}" : record_str);
        const ExecutionRecord record = deserialize_execution_record(record_json);
        const json policy = parse_optional_object_json(policy_json);
        const std::string tool_name = extract_tool_name_from_record(record);

        std::string tool_description;
        json tool_parameters = json::object();
        json tool_constraints = json::object();
        load_registered_tool_metadata(
            tool_name,
            &tool_description,
            &tool_parameters,
            &tool_constraints
        );

        const json sdk_bundle = better_agent::sdk_bridge::build_claude_bundle(
            tool_name,
            tool_description,
            tool_parameters,
            tool_constraints,
            record.input_normalized,
            policy,
            extract_provider_call_id(record)
        );

        json out = build_provider_execution_wrapper(
            record_json,
            build_claude_tool_result_payload(record, ""),
            sdk_bundle
        );
        g_last_output = out.dump();
        return g_last_output.c_str();
    } catch (...) {
        return record_str;
    }
}

const char *agent_core_get_execution(const char *execution_id) {
    g_last_error.clear();
    g_last_output.clear();
    if (execution_id == nullptr) {
        const json err{
            {"error_code", "E_INPUT"},
            {"message", "execution_id is null"}
        };
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }

    std::lock_guard<std::mutex> lk(g_tools_mu);
    const std::string id = execution_id;
    if (!g_executions.contains(id)) {
        const json err{
            {"error_code", "E_NOT_FOUND"},
            {"message", "execution not found"},
            {"detail", json{{"execution_id", id}}}
        };
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }

    g_last_output = serialize_execution_record(g_executions.at(id)).dump();
    return g_last_output.c_str();
}

const char *agent_core_build_openai_function_call_output(
    const char *execution_id,
    const char *call_id_override
) {
    g_last_error.clear();
    g_last_output.clear();

    if (execution_id == nullptr) {
        const json err{{"error_code", "E_INPUT"}, {"message", "execution_id is null"}};
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }

    std::lock_guard<std::mutex> lk(g_tools_mu);
    const std::string id = execution_id;
    if (!g_executions.contains(id)) {
        const json err{
            {"error_code", "E_NOT_FOUND"},
            {"message", "execution not found"},
            {"detail", json{{"execution_id", id}}}
        };
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }

    const ExecutionRecord &record = g_executions.at(id);
    const std::string call_id = (call_id_override == nullptr) ? "" : std::string(call_id_override);
    g_last_output = build_openai_function_call_output_payload(record, call_id).dump();
    return g_last_output.c_str();
}

const char *agent_core_build_claude_tool_result(
    const char *execution_id,
    const char *tool_use_id_override
) {
    g_last_error.clear();
    g_last_output.clear();

    if (execution_id == nullptr) {
        const json err{{"error_code", "E_INPUT"}, {"message", "execution_id is null"}};
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }

    std::lock_guard<std::mutex> lk(g_tools_mu);
    const std::string id = execution_id;
    if (!g_executions.contains(id)) {
        const json err{
            {"error_code", "E_NOT_FOUND"},
            {"message", "execution not found"},
            {"detail", json{{"execution_id", id}}}
        };
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }

    const ExecutionRecord &record = g_executions.at(id);
    const std::string tool_use_id = (tool_use_id_override == nullptr) ? "" : std::string(tool_use_id_override);
    g_last_output = build_claude_tool_result_payload(record, tool_use_id).dump();
    return g_last_output.c_str();
}

const char *agent_core_normalize_runtime_event(const char *raw_event_json) {
    g_last_error.clear();
    g_last_output.clear();

    if (raw_event_json == nullptr) {
        g_last_error = "raw_event_json is null";
        RuntimeEventRecord out = base_runtime_record(json::object());
        out.execution_id = next_id("invalid");
        out.status = "failed";
        out.error = json{{"code", "invalid_input"}, {"message", g_last_error}};
        out.handoff = "manual_takeover";
        g_last_output = serialize_runtime_event_record(out).dump();
        return g_last_output.c_str();
    }

    try {
        const json raw = json::parse(raw_event_json);
        RuntimeEventRecord out = normalize_runtime_event(raw);
        g_last_output = serialize_runtime_event_record(out).dump();
        return g_last_output.c_str();
    } catch (const std::exception &e) {
        g_last_error = e.what();
        RuntimeEventRecord out = base_runtime_record(json{{"raw_text", raw_event_json}});
        out.execution_id = next_id("parse-error");
        out.status = "failed";
        out.error = json{
            {"code", "invalid_json"},
            {"message", g_last_error}
        };
        out.handoff = "manual_takeover";
        g_last_output = serialize_runtime_event_record(out).dump();
        return g_last_output.c_str();
    }
}

const char *agent_core_last_error(void) {
    return g_last_error.c_str();
}
