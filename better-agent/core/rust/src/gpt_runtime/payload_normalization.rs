use serde_json::{json, Value};

pub fn normalize_tool_payload(raw: &Value) -> Result<Value, Value> {
    if raw.is_object() && raw.get("type").and_then(Value::as_str) == Some("function_call") {
        let args = if let Some(arguments) = raw.get("arguments") {
            if let Some(text) = arguments.as_str() {
                serde_json::from_str::<Value>(text).map_err(|_| {
                    json!({
                        "error_code": "E_PARSE",
                        "message": "function_call.arguments is not valid JSON"
                    })
                })?
            } else if arguments.is_object() {
                arguments.clone()
            } else {
                json!({})
            }
        } else {
            json!({})
        };

        return Ok(json!({
            "provider_kind": "openai",
            "tool_name": raw.get("name").and_then(Value::as_str).unwrap_or(""),
            "intent": raw.get("intent").and_then(Value::as_str).unwrap_or("function_call"),
            "provider_call_id": raw.get("call_id").and_then(Value::as_str).unwrap_or(""),
            "input_raw": raw,
            "input_normalized": args
        }));
    }

    if raw.is_object() && raw.get("type").and_then(Value::as_str) == Some("tool_use") {
        return Ok(json!({
            "provider_kind": "claude",
            "tool_name": raw.get("name").and_then(Value::as_str).unwrap_or(""),
            "intent": raw.get("intent").and_then(Value::as_str).unwrap_or("tool_use"),
            "provider_call_id": raw.get("id").and_then(Value::as_str).unwrap_or(""),
            "input_raw": raw,
            "input_normalized": raw.get("input").cloned().unwrap_or_else(|| json!({}))
        }));
    }

    if raw.is_object() && raw.get("type").and_then(Value::as_str) == Some("custom_tool_call") {
        return Ok(json!({
            "provider_kind": "openai",
            "tool_name": raw.get("name").and_then(Value::as_str).unwrap_or(""),
            "intent": raw.get("intent").and_then(Value::as_str).unwrap_or("custom_tool_call"),
            "provider_call_id": raw.get("call_id").and_then(Value::as_str).unwrap_or(""),
            "input_raw": raw,
            "input_normalized": {
                "input": raw.get("input").cloned().unwrap_or_else(|| Value::String(String::new()))
            }
        }));
    }

    if raw.is_object() && raw.get("type").and_then(Value::as_str) == Some("local_shell_call") {
        let action = raw.get("action").cloned().unwrap_or_else(|| json!({}));
        let exec = if action.get("type").and_then(Value::as_str) == Some("exec") {
            action.clone()
        } else {
            json!({})
        };
        return Ok(json!({
            "provider_kind": "openai",
            "tool_name": "local_shell",
            "intent": raw.get("intent").and_then(Value::as_str).unwrap_or("local_shell_call"),
            "provider_call_id": raw
                .get("call_id")
                .and_then(Value::as_str)
                .or_else(|| raw.get("id").and_then(Value::as_str))
                .unwrap_or(""),
            "input_raw": raw,
            "input_normalized": {
                "status": raw.get("status").cloned().unwrap_or(Value::Null),
                "command": exec.get("command").cloned().unwrap_or_else(|| json!([])),
                "timeout_ms": exec.get("timeout_ms").cloned().unwrap_or(Value::Null),
                "workdir": exec.get("working_directory").cloned().unwrap_or(Value::Null),
                "env": exec.get("env").cloned().unwrap_or(Value::Null),
                "user": exec.get("user").cloned().unwrap_or(Value::Null)
            }
        }));
    }

    if raw.is_object() && raw.get("tool").is_some() {
        return Ok(json!({
            "provider_kind": "custom",
            "tool_name": raw.get("tool").and_then(Value::as_str).unwrap_or(""),
            "intent": raw.get("intent").and_then(Value::as_str).unwrap_or("custom_tool"),
            "provider_call_id": raw.get("call_id").and_then(Value::as_str).unwrap_or(""),
            "input_raw": raw,
            "input_normalized": raw.get("arguments").cloned().unwrap_or_else(|| json!({}))
        }));
    }

    Err(json!({
        "error_code": "E_PARSE",
        "message": "unsupported function/custom tool payload"
    }))
}
