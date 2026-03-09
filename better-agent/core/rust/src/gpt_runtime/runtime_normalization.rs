use serde_json::{json, Value};

fn now_string() -> String {
    "1970-01-01T00:00:00Z".to_string()
}

fn next_id(prefix: &str, raw: &Value) -> String {
    let hint = raw
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .replace('.', "_");
    format!("{prefix}_{hint}")
}

fn base_runtime_record(raw: &Value) -> Value {
    json!({
        "execution_id": "",
        "source": "unknown",
        "event_type": "unknown",
        "tool_kind": "function",
        "intent": Value::Null,
        "input_raw": raw,
        "input_normalized": {},
        "policy_snapshot": {},
        "status": "partial",
        "evidence": [],
        "error": Value::Null,
        "handoff": "continue_observing",
        "timestamp": now_string()
    })
}

fn default_handoff(status: &str) -> &'static str {
    match status {
        "success" => "continue",
        "running" => "continue_observing",
        "blocked" => "await_permission",
        "failed" => "retry_or_manual_takeover",
        _ => "continue_observing",
    }
}

fn codex_tool_kind(item_type: &str) -> &'static str {
    match item_type {
        "command_execution" => "shell",
        "local_shell_call" => "shell",
        "mcp_tool_call" => "mcp",
        "web_search" => "web",
        "file_change" => "function",
        _ => "function",
    }
}

fn claude_tool_kind(tool_name: &str) -> &'static str {
    let lower = tool_name.to_ascii_lowercase();
    if lower.contains("bash") || lower.contains("shell") {
        "shell"
    } else if lower.contains("mcp") {
        "mcp"
    } else {
        "function"
    }
}

fn codex_item_status(event_type: &str, item: &Value) -> &'static str {
    if event_type == "item.started" {
        return "running";
    }
    if event_type == "item.completed" {
        if item.get("error").is_some() && !item.get("error").unwrap_or(&Value::Null).is_null() {
            return "failed";
        }
        if item.get("exit_code").and_then(Value::as_i64) == Some(0) || item.get("status").and_then(Value::as_str) == Some("completed") {
            return "success";
        }
        return "failed";
    }
    "partial"
}

fn normalize_codex(raw: &Value) -> Value {
    let mut out = base_runtime_record(raw);
    let event_type = raw.get("type").and_then(Value::as_str).unwrap_or("unknown");
    out["source"] = json!("codex_cli");
    out["event_type"] = json!(event_type);
    out["execution_id"] = json!(next_id("codex", raw));

    match event_type {
        "turn.started" => {
            out["status"] = json!("running");
            out["intent"] = json!("turn_start");
        }
        "turn.completed" => {
            out["status"] = json!("success");
            out["intent"] = json!("turn_complete");
            if let Some(usage) = raw.get("usage") {
                out["evidence"] = json!([{ "usage": usage }]);
            }
        }
        "turn.failed" => {
            out["status"] = json!("failed");
            out["intent"] = json!("turn_failed");
            if let Some(error) = raw.get("error") {
                out["error"] = error.clone();
            }
        }
        "error" => {
            out["status"] = json!("failed");
            out["intent"] = json!("stream_error");
            out["error"] = raw.clone();
        }
        "item.started" | "item.updated" | "item.completed" => {
            let item = raw.get("item").cloned().unwrap_or_else(|| json!({}));
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or("item");
            let item_type = item.get("type").and_then(Value::as_str).unwrap_or("unknown");
            out["execution_id"] = json!(item_id);
            out["tool_kind"] = json!(codex_tool_kind(item_type));
            out["intent"] = json!(item_type);
            out["input_raw"] = item.clone();
            out["status"] = json!(codex_item_status(event_type, &item));

            match item_type {
                "command_execution" => {
                    out["input_normalized"] = json!({ "command": item.get("command").and_then(Value::as_str).unwrap_or("") });
                    out["evidence"] = json!([{
                        "stdout": item.get("stdout").cloned().unwrap_or(Value::Null),
                        "stderr": item.get("stderr").cloned().unwrap_or(Value::Null),
                        "aggregated_output": item.get("aggregated_output").cloned().unwrap_or(Value::String(String::new())),
                        "exit_code": item.get("exit_code").cloned().unwrap_or(Value::Null),
                        "duration_ms": item.get("duration_ms").cloned().unwrap_or(Value::Null),
                        "formatted_output": item.get("formatted_output").cloned().unwrap_or(Value::Null),
                        "status": item.get("status").cloned().unwrap_or(Value::Null)
                    }]);
                }
                "mcp_tool_call" => {
                    out["input_normalized"] = json!({
                        "server": item.get("server").and_then(Value::as_str).unwrap_or(""),
                        "tool": item.get("tool").and_then(Value::as_str).unwrap_or(""),
                        "arguments": item.get("arguments").cloned().unwrap_or_else(|| json!({}))
                    });
                    if let Some(result) = item.get("result") {
                        out["evidence"] = json!([{ "result": result }]);
                    }
                    if let Some(error) = item.get("error") {
                        if !error.is_null() {
                            out["error"] = error.clone();
                        }
                    }
                }
                "web_search" => {
                    out["input_normalized"] = json!({
                        "query": item.get("query").and_then(Value::as_str).unwrap_or(""),
                        "action": item.get("action").and_then(Value::as_str).unwrap_or("")
                    });
                }
                "file_change" => {
                    out["input_normalized"] = json!({ "changes": item.get("changes").cloned().unwrap_or_else(|| json!([])) });
                    out["evidence"] = json!([{ "changes": item.get("changes").cloned().unwrap_or_else(|| json!([])) }]);
                }
                _ => {
                    out["input_normalized"] = item;
                }
            }
        }
        "thread.started" => {
            out["status"] = json!("success");
            out["intent"] = json!("thread_start");
            out["execution_id"] = raw.get("thread_id").cloned().unwrap_or_else(|| json!(next_id("thread", raw)));
        }
        _ => {}
    }
    let status = out.get("status").and_then(Value::as_str).unwrap_or("partial");
    out["handoff"] = json!(default_handoff(status));
    out
}

fn normalize_claude(raw: &Value) -> Value {
    let mut out = base_runtime_record(raw);
    let event_type = raw.get("type").and_then(Value::as_str).unwrap_or("unknown");
    out["source"] = json!("claude_code");
    out["event_type"] = json!(event_type);
    out["execution_id"] = json!(raw.get("uuid").and_then(Value::as_str).unwrap_or(&next_id("claude", raw)));
    if let Some(session_id) = raw.get("session_id") {
        out["policy_snapshot"] = json!({ "session_id": session_id });
    }

    if event_type == "control_request" {
        let request = raw.get("request").cloned().unwrap_or_else(|| json!({}));
        let subtype = request.get("subtype").and_then(Value::as_str).unwrap_or("unknown");
        out["event_type"] = json!(format!("control_request.{subtype}"));
        out["execution_id"] = request.get("tool_use_id").cloned().unwrap_or_else(|| json!(next_id("claude_tool", &request)));
        out["status"] = json!("blocked");
        out["intent"] = json!(subtype);
        out["input_raw"] = request.clone();
        if subtype == "can_use_tool" {
            let tool_name = request.get("tool_name").and_then(Value::as_str).unwrap_or("");
            out["tool_kind"] = json!(claude_tool_kind(tool_name));
            out["input_normalized"] = json!({
                "tool_name": tool_name,
                "input": request.get("input").cloned().unwrap_or_else(|| json!({}))
            });
            if let Some(reason) = request.get("decision_reason") {
                out["evidence"] = json!([{ "decision_reason": reason }]);
            }
            out["handoff"] = json!("await_permission");
            return out;
        }
    } else if event_type == "result" {
        let subtype = raw.get("subtype").and_then(Value::as_str).unwrap_or("unknown");
        out["event_type"] = json!(format!("result.{subtype}"));
        out["status"] = json!(if subtype == "success" { "success" } else { "failed" });
        out["intent"] = json!("turn_result");
        out["input_normalized"] = json!({
            "stop_reason": raw.get("stop_reason").cloned().unwrap_or(Value::Null),
            "num_turns": raw.get("num_turns").cloned().unwrap_or(Value::Null),
            "duration_ms": raw.get("duration_ms").cloned().unwrap_or(Value::Null),
            "duration_api_ms": raw.get("duration_api_ms").cloned().unwrap_or(Value::Null),
            "total_cost_usd": raw.get("total_cost_usd").cloned().unwrap_or(Value::Null)
        });
        if let Some(usage) = raw.get("usage") {
            out["evidence"] = json!([{ "usage": usage }]);
        }
    }
    let status = out.get("status").and_then(Value::as_str).unwrap_or("partial");
    out["handoff"] = json!(default_handoff(status));
    out
}

fn normalize_unknown(raw: &Value) -> Value {
    let mut out = base_runtime_record(raw);
    let event_type = raw.get("type").and_then(Value::as_str).unwrap_or("unknown");
    match event_type {
        "function_call" => {
            out["source"] = json!("openai_responses");
            out["event_type"] = json!("function_call");
            out["execution_id"] = raw.get("call_id").cloned().unwrap_or_else(|| json!(next_id("function_call", raw)));
            out["tool_kind"] = json!("function");
            out["intent"] = json!(raw.get("name").and_then(Value::as_str).unwrap_or("function_call"));
            out["status"] = json!("running");
            out["input_normalized"] = json!({
                "tool_name": raw.get("name").and_then(Value::as_str).unwrap_or(""),
                "arguments": raw.get("arguments").cloned().unwrap_or_else(|| Value::String(String::new()))
            });
            out["handoff"] = json!("continue_observing");
        }
        "custom_tool_call" => {
            out["source"] = json!("openai_responses");
            out["event_type"] = json!("custom_tool_call");
            out["execution_id"] = raw.get("call_id").cloned().unwrap_or_else(|| json!(next_id("custom_tool_call", raw)));
            out["tool_kind"] = json!("custom");
            out["intent"] = json!(raw.get("name").and_then(Value::as_str).unwrap_or("custom_tool_call"));
            out["status"] = json!("running");
            out["input_normalized"] = json!({
                "tool_name": raw.get("name").and_then(Value::as_str).unwrap_or(""),
                "input": raw.get("input").cloned().unwrap_or_else(|| Value::String(String::new()))
            });
            out["handoff"] = json!("continue_observing");
        }
        "local_shell_call" => {
            let action = raw.get("action").cloned().unwrap_or_else(|| json!({}));
            let exec = if action.get("type").and_then(Value::as_str) == Some("exec") {
                action.clone()
            } else {
                json!({})
            };
            out["source"] = json!("openai_responses");
            out["event_type"] = json!("local_shell_call");
            out["execution_id"] = raw
                .get("call_id")
                .cloned()
                .or_else(|| raw.get("id").cloned())
                .unwrap_or_else(|| json!(next_id("local_shell_call", raw)));
            out["tool_kind"] = json!("shell");
            out["intent"] = json!("local_shell");
            out["status"] = match raw.get("status").and_then(Value::as_str).unwrap_or("in_progress") {
                "completed" => json!("success"),
                "in_progress" => json!("running"),
                "incomplete" => json!("partial"),
                _ => json!("partial"),
            };
            out["input_normalized"] = json!({
                "command": exec.get("command").cloned().unwrap_or_else(|| json!([])),
                "timeout_ms": exec.get("timeout_ms").cloned().unwrap_or(Value::Null),
                "workdir": exec.get("working_directory").cloned().unwrap_or(Value::Null),
                "env": exec.get("env").cloned().unwrap_or(Value::Null),
                "user": exec.get("user").cloned().unwrap_or(Value::Null)
            });
            out["handoff"] = json!(default_handoff(out.get("status").and_then(Value::as_str).unwrap_or("partial")));
        }
        _ => {
            out["status"] = json!("partial");
            out["intent"] = json!("unknown_event");
            out["handoff"] = json!("manual_classification");
        }
    }
    out
}

pub fn normalize_runtime_event(raw: &Value) -> Value {
    let event_type = raw.get("type").and_then(Value::as_str).unwrap_or("unknown");
    if event_type.starts_with("thread.")
        || event_type.starts_with("turn.")
        || event_type.starts_with("item.")
        || event_type == "error"
    {
        return normalize_codex(raw);
    }
    if raw.get("session_id").is_some()
        || matches!(event_type, "control_request" | "result" | "assistant" | "stream_event" | "system")
    {
        return normalize_claude(raw);
    }
    normalize_unknown(raw)
}
