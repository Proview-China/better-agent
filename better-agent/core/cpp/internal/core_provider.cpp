#include "agent_core_internal.hpp"

namespace better_agent::core_internal {

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

} // namespace better_agent::core_internal
