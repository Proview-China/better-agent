#include "agent_core_internal.hpp"

namespace better_agent::core_internal {

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

} // namespace better_agent::core_internal
