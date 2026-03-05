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

#include "nlohmann/json.hpp"

namespace {

using json = nlohmann::json;

std::atomic<unsigned long long> g_seq{1};
thread_local std::string g_last_error;
thread_local std::string g_last_output;

struct ToolDefinition {
    std::string name;
    std::string description;
    json parameters;
    json constraints;
    json mock_result;
};

std::mutex g_tools_mu;
std::unordered_map<std::string, ToolDefinition> g_tools;
std::unordered_map<std::string, json> g_executions;
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

json normalize_function_call_payload(const json &raw) {
    // OpenAI Responses function_call
    if (raw.is_object() && get_string_or(raw, "type") == "function_call") {
        json args = json::object();
        if (raw.contains("arguments")) {
            if (raw.at("arguments").is_string()) {
                args = json::parse(raw.at("arguments").get<std::string>(), nullptr, false);
                if (args.is_discarded()) {
                    return json{
                        {"error_code", "E_PARSE"},
                        {"message", "function_call.arguments is not valid JSON"}
                    };
                }
            } else if (raw.at("arguments").is_object()) {
                args = raw.at("arguments");
            }
        }

        return json{
            {"provider_kind", "openai"},
            {"tool_name", get_string_or(raw, "name")},
            {"intent", get_string_or(raw, "intent", "function_call")},
            {"input_raw", raw},
            {"input_normalized", args},
            {"provider_call_id", get_string_or(raw, "call_id")}
        };
    }

    // Anthropic tool_use
    if (raw.is_object() && get_string_or(raw, "type") == "tool_use") {
        return json{
            {"provider_kind", "claude"},
            {"tool_name", get_string_or(raw, "name")},
            {"intent", get_string_or(raw, "intent", "tool_use")},
            {"input_raw", raw},
            {"input_normalized", raw.value("input", json::object())},
            {"provider_call_id", get_string_or(raw, "id")}
        };
    }

    // Generic custom call
    if (raw.is_object() && raw.contains("tool")) {
        return json{
            {"provider_kind", "custom"},
            {"tool_name", get_string_or(raw, "tool")},
            {"intent", get_string_or(raw, "intent", "custom_tool")},
            {"input_raw", raw},
            {"input_normalized", raw.value("arguments", json::object())},
            {"provider_call_id", get_string_or(raw, "call_id")}
        };
    }

    return json{
        {"error_code", "E_PARSE"},
        {"message", "unsupported function/custom tool payload"}
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

json base_record(const json &raw) {
    return json{
        {"execution_id", ""},
        {"source", "unknown"},
        {"event_type", "unknown"},
        {"tool_kind", "function"},
        {"intent", nullptr},
        {"input_raw", raw},
        {"input_normalized", json::object()},
        {"policy_snapshot", json::object()},
        {"status", "partial"},
        {"evidence", json::array()},
        {"error", nullptr},
        {"handoff", "continue_observing"},
        {"timestamp", now_iso8601_utc()}
    };
}

json normalize_codex(const json &raw) {
    json out = base_record(raw);
    const std::string event_type = get_string_or(raw, "type", "unknown");

    out["source"] = "codex_cli";
    out["event_type"] = event_type;
    out["execution_id"] = next_id("codex");

    if (event_type == "turn.started") {
        out["status"] = "running";
        out["intent"] = "turn_start";
    } else if (event_type == "turn.completed") {
        out["status"] = "success";
        out["intent"] = "turn_complete";
        if (raw.contains("usage")) {
            out["evidence"].push_back(json{{"usage", raw.at("usage")}});
        }
    } else if (event_type == "turn.failed") {
        out["status"] = "failed";
        out["intent"] = "turn_failed";
        if (raw.contains("error")) {
            out["error"] = raw.at("error");
        }
    } else if (event_type == "error") {
        out["status"] = "failed";
        out["intent"] = "stream_error";
        out["error"] = raw;
    } else if (event_type == "item.started" || event_type == "item.updated" || event_type == "item.completed") {
        const json item = raw.value("item", json::object());
        const std::string item_id = get_string_or(item, "id", next_id("item"));
        const std::string item_type = get_string_or(item, "type", "unknown");

        out["execution_id"] = item_id;
        out["tool_kind"] = codex_tool_kind(item_type);
        out["intent"] = item_type;
        out["input_raw"] = item;
        out["status"] = get_status_from_codex_item(event_type, item);

        if (item_type == "command_execution") {
            out["input_normalized"] = json{{"command", item.value("command", "")}};
            out["evidence"].push_back(json{
                {"aggregated_output", item.value("aggregated_output", "")},
                {"exit_code", get_json_or(item, "exit_code", nullptr)}
            });
        } else if (item_type == "mcp_tool_call") {
            out["input_normalized"] = json{
                {"server", item.value("server", "")},
                {"tool", item.value("tool", "")},
                {"arguments", item.value("arguments", json::object())}
            };
            if (item.contains("result")) {
                out["evidence"].push_back(json{{"result", item.at("result")}});
            }
            if (item.contains("error") && !item.at("error").is_null()) {
                out["error"] = item.at("error");
            }
        } else if (item_type == "web_search") {
            out["input_normalized"] = json{
                {"query", item.value("query", "")},
                {"action", item.value("action", "")}
            };
        } else if (item_type == "file_change") {
            out["input_normalized"] = json{{"changes", item.value("changes", json::array())}};
            out["evidence"].push_back(json{{"changes", item.value("changes", json::array())}});
        } else {
            out["input_normalized"] = item;
        }
    } else if (event_type == "thread.started") {
        out["status"] = "success";
        out["intent"] = "thread_start";
        out["execution_id"] = raw.value("thread_id", next_id("thread"));
    }

    out["handoff"] = default_handoff(out.value("status", "partial"));
    return out;
}

json normalize_claude(const json &raw) {
    json out = base_record(raw);
    const std::string event_type = get_string_or(raw, "type", "unknown");

    out["source"] = "claude_code";
    out["event_type"] = event_type;
    out["execution_id"] = get_string_or(raw, "uuid", next_id("claude"));

    if (raw.contains("session_id")) {
        out["policy_snapshot"]["session_id"] = raw.at("session_id");
    }

    if (event_type == "control_request") {
        const json request = raw.value("request", json::object());
        const std::string subtype = get_string_or(request, "subtype", "unknown");
        out["event_type"] = "control_request." + subtype;
        out["execution_id"] = request.value("tool_use_id", next_id("claude-tool"));
        out["status"] = "blocked";
        out["intent"] = subtype;
        out["input_raw"] = request;

        if (subtype == "can_use_tool") {
            const std::string tool_name = request.value("tool_name", "");
            out["tool_kind"] = claude_tool_kind(tool_name);
            out["input_normalized"] = json{
                {"tool_name", tool_name},
                {"input", request.value("input", json::object())}
            };
            if (request.contains("decision_reason")) {
                out["evidence"].push_back(json{{"decision_reason", request.at("decision_reason")}});
            }
            if (request.contains("blocked_path")) {
                out["evidence"].push_back(json{{"blocked_path", request.at("blocked_path")}});
            }
            out["handoff"] = "await_permission";
            return out;
        }

        out["input_normalized"] = request;
        out["handoff"] = "continue_observing";
        return out;
    }

    if (event_type == "result") {
        const std::string subtype = get_string_or(raw, "subtype", "unknown");
        out["event_type"] = "result." + subtype;
        out["intent"] = "turn_result";
        out["tool_kind"] = "function";
        out["status"] = (subtype == "success") ? "success" : "failed";
        out["input_normalized"] = json{
            {"stop_reason", get_json_or(raw, "stop_reason", nullptr)},
            {"num_turns", raw.value("num_turns", 0)},
            {"usage", raw.value("usage", json::object())}
        };
        out["evidence"].push_back(json{
            {"duration_ms", raw.value("duration_ms", 0)},
            {"duration_api_ms", raw.value("duration_api_ms", 0)},
            {"total_cost_usd", raw.value("total_cost_usd", 0.0)}
        });

        if (subtype != "success") {
            out["error"] = json{
                {"subtype", subtype},
                {"errors", raw.value("errors", json::array())}
            };
        }
    } else if (event_type == "assistant") {
        out["status"] = "success";
        out["intent"] = "assistant_message";
        out["input_normalized"] = json{{"message", raw.value("message", json::object())}};
    } else if (event_type == "stream_event") {
        out["status"] = "running";
        out["intent"] = "partial_stream";
        out["input_normalized"] = json{{"event", raw.value("event", json::object())}};
    } else if (event_type == "system") {
        const std::string subtype = get_string_or(raw, "subtype", "unknown");
        out["event_type"] = "system." + subtype;
        out["intent"] = subtype;
        out["tool_kind"] = (subtype.rfind("hook_", 0) == 0) ? "hooks" : "function";
        out["status"] = "running";
        out["input_normalized"] = raw;

        if (subtype == "hook_response") {
            const std::string outcome = get_string_or(raw, "outcome", "success");
            if (outcome == "error" || outcome == "cancelled") {
                out["status"] = "failed";
                out["error"] = json{{"outcome", outcome}};
            } else {
                out["status"] = "success";
            }
        }
    } else {
        out["intent"] = event_type;
        out["status"] = "partial";
        out["input_normalized"] = raw;
    }

    out["handoff"] = default_handoff(out.value("status", "partial"));
    return out;
}

json normalize_unknown(const json &raw) {
    json out = base_record(raw);
    out["execution_id"] = next_id("unknown");
    out["status"] = "partial";
    out["intent"] = "unknown_event";
    out["handoff"] = "manual_classification";
    return out;
}

json normalize_runtime_event(const json &raw) {
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
        const json raw = json::parse(tool_definition_json);
        const std::string name = get_string_or(raw, "name");
        if (name.empty()) {
            g_last_error = R"({"error_code":"E_TOOL_DEF","message":"tool definition requires non-empty name"})";
            return 2;
        }

        ToolDefinition def{
            .name = name,
            .description = get_string_or(raw, "description"),
            .parameters = raw.value("parameters", json::object()),
            .constraints = raw.value("constraints", json::object()),
            .mock_result = raw.value("mock_result", json::object()),
        };

        std::lock_guard<std::mutex> lk(g_tools_mu);
        g_tools[name] = std::move(def);
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
        const json raw = json::parse(model_output_json);
        json policy_err;
        const json policy = parse_policy_json(policy_json, &policy_err);
        if (!policy_err.is_null()) {
            g_last_error = policy_err.dump();
            g_last_output = json{{"status", "failed"}, {"error", policy_err}}.dump();
            return g_last_output.c_str();
        }

        const json normalized = normalize_function_call_payload(raw);
        if (normalized.contains("error_code")) {
            g_last_error = normalized.dump();
            g_last_output = json{{"status", "failed"}, {"error", normalized}}.dump();
            return g_last_output.c_str();
        }

        const std::string tool_name = normalized.value("tool_name", "");
        if (tool_name.empty()) {
            g_last_error = R"({"error_code":"E_PARSE","message":"normalized tool_name is empty"})";
            g_last_output = json{{"status", "failed"}, {"error", json::parse(g_last_error)}}.dump();
            return g_last_output.c_str();
        }

        std::lock_guard<std::mutex> lk(g_tools_mu);

        const std::string idem = policy.value("idempotency_key", "");
        const std::string provider_kind = normalized.value("provider_kind", "custom");
        const std::string idem_signature =
            provider_kind + "|" + normalized.value("tool_name", "") + "|" +
            normalized.value("input_normalized", json::object()).dump();
        if (!idem.empty() && g_idempotency_to_execution.contains(idem)) {
            if (g_idempotency_signature.contains(idem) && g_idempotency_signature.at(idem) != idem_signature) {
                const json err{
                    {"error_code", "E_IDEMPOTENCY_CONFLICT"},
                    {"message", "idempotency_key reused with different provider/tool/arguments"},
                    {"detail", json{{"idempotency_key", idem}}}
                };
                g_last_error = err.dump();
                g_last_output = json{
                    {"status", "failed"},
                    {"error", err}
                }.dump();
                return g_last_output.c_str();
            }
            const std::string exec_id = g_idempotency_to_execution.at(idem);
            if (g_executions.contains(exec_id)) {
                json replay = g_executions.at(exec_id);
                replay["handoff"] = "idempotency-hit: reuse previous execution";
                g_last_output = replay.dump();
                return g_last_output.c_str();
            }
        }

        if (!g_tools.contains(tool_name)) {
            json err{
                {"error_code", "E_TOOL_NOT_FOUND"},
                {"message", "tool is not registered"},
                {"detail", json{{"tool", tool_name}}}
            };
            g_last_error = err.dump();
            g_last_output = json{
                {"status", "failed"},
                {"tool_name", tool_name},
                {"error", err}
            }.dump();
            return g_last_output.c_str();
        }

        const ToolDefinition &tool = g_tools.at(tool_name);
        const json args = normalized.value("input_normalized", json::object());
        const json schema_err = schema_validate_args(args, tool.parameters);
        if (!schema_err.empty()) {
            g_last_error = schema_err.dump();
            g_last_output = json{
                {"status", "failed"},
                {"tool_name", tool_name},
                {"error", schema_err}
            }.dump();
            return g_last_output.c_str();
        }

        if (policy.contains("deny_tools") && policy.at("deny_tools").is_array()) {
            for (const auto &denied : policy.at("deny_tools")) {
                if (denied.is_string() && denied.get<std::string>() == tool_name) {
                    const json err{
                        {"error_code", "E_POLICY_DENY"},
                        {"message", "tool denied by policy"},
                        {"detail", json{{"tool", tool_name}}}
                    };
                    g_last_error = err.dump();
                    g_last_output = json{
                        {"status", "blocked"},
                        {"tool_name", tool_name},
                        {"error", err}
                    }.dump();
                    return g_last_output.c_str();
                }
            }
        }
        if (policy.contains("allow_tools") && policy.at("allow_tools").is_array()) {
            bool allowed = false;
            for (const auto &allowed_tool : policy.at("allow_tools")) {
                if (allowed_tool.is_string() && allowed_tool.get<std::string>() == tool_name) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                const json err{
                    {"error_code", "E_POLICY_DENY"},
                    {"message", "tool not in allow_tools"},
                    {"detail", json{{"tool", tool_name}}}
                };
                g_last_error = err.dump();
                g_last_output = json{
                    {"status", "blocked"},
                    {"tool_name", tool_name},
                    {"error", err}
                }.dump();
                return g_last_output.c_str();
            }
        }

        const std::string execution_id = next_id("exec");
        const json result = (tool.mock_result.is_object() && !tool.mock_result.empty())
            ? tool.mock_result
            : json{{"ok", true}, {"echo", args}};

        json record{
            {"execution_id", execution_id},
            {"tool_kind", "function"},
            {"provider_kind", provider_kind},
            {"intent", normalized.value("intent", "function_call")},
            {"provider_call_id", normalized.value("provider_call_id", "")},
            {"input_raw", normalized.value("input_raw", json::object())},
            {"input_normalized", args},
            {"policy_snapshot", policy},
            {"status", "success"},
            {"evidence", json::array({
                json{{"kind", "runtime_event"}, {"value", "tool_executed"}},
                json{{"kind", "provider_kind"}, {"value", provider_kind}},
                json{{"kind", "provider_call_id"}, {"value", normalized.value("provider_call_id", "")}},
                json{{"kind", "timestamp"}, {"value", now_iso8601_utc()}}
            })},
            {"error", nullptr},
            {"handoff", "continue"},
            {"timestamp", now_iso8601_utc()},
            {"result", result}
        };

        g_executions[execution_id] = record;
        if (!idem.empty()) {
            g_idempotency_to_execution[idem] = execution_id;
            g_idempotency_signature[idem] = idem_signature;
        }
        g_last_output = record.dump();
        return g_last_output.c_str();
    } catch (const std::exception &e) {
        const json err{
            {"error_code", "E_PARSE"},
            {"message", "invalid model_output_json"},
            {"detail", e.what()}
        };
        g_last_error = err.dump();
        g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return g_last_output.c_str();
    }
}

const char *agent_core_execute_openai_function_call(const char *openai_function_call_json, const char *policy_json) {
    const char *record_str = agent_core_execute_function_call(openai_function_call_json, policy_json);
    try {
        const json record = json::parse(record_str == nullptr ? "{}" : record_str);
        const json policy = (policy_json == nullptr)
            ? json::object()
            : json::parse(policy_json, nullptr, false).is_object()
                ? json::parse(policy_json, nullptr, false)
                : json::object();
        const std::string tool_name = extract_tool_name_from_record(record);

        std::string tool_description;
        json tool_parameters = json::object();
        json tool_constraints = json::object();
        {
            std::lock_guard<std::mutex> lk(g_tools_mu);
            if (!tool_name.empty() && g_tools.contains(tool_name)) {
                const ToolDefinition &tool = g_tools.at(tool_name);
                tool_description = tool.description;
                tool_parameters = tool.parameters;
                tool_constraints = tool.constraints;
            }
        }

        const json sdk_bundle = better_agent::sdk_bridge::build_openai_bundle(
            tool_name,
            tool_description,
            tool_parameters,
            tool_constraints,
            record.value("input_normalized", json::object()),
            policy,
            extract_provider_call_id(record)
        );

        json out{
            {"execution", record},
            {"provider_payload", build_openai_function_call_output_payload(record, "")},
            {"sdk", sdk_bundle}
        };
        g_last_output = out.dump();
        return g_last_output.c_str();
    } catch (...) {
        return record_str;
    }
}

const char *agent_core_execute_claude_tool_use(const char *claude_tool_use_json, const char *policy_json) {
    const char *record_str = agent_core_execute_function_call(claude_tool_use_json, policy_json);
    try {
        const json record = json::parse(record_str == nullptr ? "{}" : record_str);
        const json policy = (policy_json == nullptr)
            ? json::object()
            : json::parse(policy_json, nullptr, false).is_object()
                ? json::parse(policy_json, nullptr, false)
                : json::object();
        const std::string tool_name = extract_tool_name_from_record(record);

        std::string tool_description;
        json tool_parameters = json::object();
        json tool_constraints = json::object();
        {
            std::lock_guard<std::mutex> lk(g_tools_mu);
            if (!tool_name.empty() && g_tools.contains(tool_name)) {
                const ToolDefinition &tool = g_tools.at(tool_name);
                tool_description = tool.description;
                tool_parameters = tool.parameters;
                tool_constraints = tool.constraints;
            }
        }

        const json sdk_bundle = better_agent::sdk_bridge::build_claude_bundle(
            tool_name,
            tool_description,
            tool_parameters,
            tool_constraints,
            record.value("input_normalized", json::object()),
            policy,
            extract_provider_call_id(record)
        );

        json out{
            {"execution", record},
            {"provider_payload", build_claude_tool_result_payload(record, "")},
            {"sdk", sdk_bundle}
        };
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

    g_last_output = g_executions.at(id).dump();
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

    const json &record = g_executions.at(id);
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

    const json &record = g_executions.at(id);
    const std::string tool_use_id = (tool_use_id_override == nullptr) ? "" : std::string(tool_use_id_override);
    g_last_output = build_claude_tool_result_payload(record, tool_use_id).dump();
    return g_last_output.c_str();
}

const char *agent_core_normalize_runtime_event(const char *raw_event_json) {
    g_last_error.clear();
    g_last_output.clear();

    if (raw_event_json == nullptr) {
        g_last_error = "raw_event_json is null";
        json out = base_record(json::object());
        out["execution_id"] = next_id("invalid");
        out["status"] = "failed";
        out["error"] = json{{"code", "invalid_input"}, {"message", g_last_error}};
        out["handoff"] = "manual_takeover";
        g_last_output = out.dump();
        return g_last_output.c_str();
    }

    try {
        const json raw = json::parse(raw_event_json);
        json out = normalize_runtime_event(raw);
        g_last_output = out.dump();
        return g_last_output.c_str();
    } catch (const std::exception &e) {
        g_last_error = e.what();
        json out = base_record(json{{"raw_text", raw_event_json}});
        out["execution_id"] = next_id("parse-error");
        out["status"] = "failed";
        out["error"] = json{
            {"code", "invalid_json"},
            {"message", g_last_error}
        };
        out["handoff"] = "manual_takeover";
        g_last_output = out.dump();
        return g_last_output.c_str();
    }
}

const char *agent_core_last_error(void) {
    return g_last_error.c_str();
}
