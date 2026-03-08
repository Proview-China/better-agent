use serde_json::{json, Value};

fn provider_call_id(record: &Value) -> String {
    if let Some(call_id) = record.get("provider_call_id").and_then(Value::as_str) {
        return call_id.to_string();
    }
    if let Some(evidence) = record.get("evidence").and_then(Value::as_array) {
        for item in evidence {
            if item.get("kind").and_then(Value::as_str) == Some("provider_call_id") {
                if let Some(value) = item.get("value").and_then(Value::as_str) {
                    return value.to_string();
                }
            }
        }
    }
    String::new()
}

pub fn build_openai_function_call_output_payload(
    record: &Value,
    call_id_override: Option<&str>,
) -> Value {
    let status = record.get("status").and_then(Value::as_str).unwrap_or("failed");
    let success = status == "success";
    let call_id = call_id_override
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| provider_call_id(record));

    let output_body = if success {
        record.get("result").cloned().unwrap_or_else(|| json!({}))
    } else {
        json!({
            "status": status,
            "error": record.get("error").cloned().unwrap_or_else(|| json!({}))
        })
    };

    json!({
        "type": "function_call_output",
        "call_id": call_id,
        "output": output_body
    })
}

pub fn extract_provider_call_id(record: &Value) -> String {
    provider_call_id(record)
}

pub fn extract_tool_name(record: &Value) -> String {
    if let Some(raw) = record.get("input_raw").and_then(Value::as_object) {
        if let Some(name) = raw.get("name").and_then(Value::as_str) {
            return name.to_string();
        }
        if let Some(tool) = raw.get("tool").and_then(Value::as_str) {
            return tool.to_string();
        }
    }
    String::new()
}
