#include "agent_core_internal.hpp"

namespace better_agent::core_internal {

namespace {

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

} // namespace

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

} // namespace better_agent::core_internal
