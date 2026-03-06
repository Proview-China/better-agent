#include "agent_core_internal.hpp"

namespace better_agent::core_internal {

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

} // namespace better_agent::core_internal
