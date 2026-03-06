#include "agent_core_internal.hpp"

namespace better_agent::core_internal {

std::string get_string_or(const json &obj, const char *key, const std::string &fallback) {
    if (!obj.is_object() || !obj.contains(key) || !obj.at(key).is_string()) {
        return fallback;
    }
    return obj.at(key).get<std::string>();
}

json get_json_or(const json &obj, const char *key, const json &fallback) {
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
    if (event_type == "item.started" || event_type == "item.updated") {
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

bool fail_function_call(const json &err, const std::string &status, const std::string &tool_name) {
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

json parse_optional_object_json(const char *json_text) {
    if (json_text == nullptr) {
        return json::object();
    }
    const json parsed = json::parse(json_text, nullptr, false);
    return parsed.is_object() ? parsed : json::object();
}

} // namespace better_agent::core_internal
