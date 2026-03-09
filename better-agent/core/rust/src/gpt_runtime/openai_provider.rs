use serde_json::{json, Value};

use crate::gpt_runtime::tool_outputs::build_tool_output_body;

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

fn build_call_output_item(output_type: &str, record: &Value, call_id_override: Option<&str>) -> Value {
    let status = record.get("status").and_then(Value::as_str).unwrap_or("failed");
    let call_id = call_id_override
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| provider_call_id(record));

    let result = record.get("result").cloned().unwrap_or_else(|| json!({}));
    let error = record.get("error").cloned().unwrap_or_else(|| json!({}));
    let output_body = build_tool_output_body(&result, status, &error).to_wire_value();

    json!({
        "type": output_type,
        "call_id": call_id,
        "output": output_body
    })
}

pub fn build_openai_function_call_output_payload(
    record: &Value,
    call_id_override: Option<&str>,
) -> Value {
    build_call_output_item("function_call_output", record, call_id_override)
}

pub fn build_openai_custom_tool_call_output_payload(
    record: &Value,
    call_id_override: Option<&str>,
) -> Value {
    build_call_output_item("custom_tool_call_output", record, call_id_override)
}

pub fn extract_provider_call_id(record: &Value) -> String {
    provider_call_id(record)
}

pub fn extract_tool_name(record: &Value) -> String {
    if let Some(raw) = record.get("input_raw").and_then(Value::as_object) {
        if raw.get("type").and_then(Value::as_str) == Some("local_shell_call") {
            return "local_shell".to_string();
        }
        if let Some(name) = raw.get("name").and_then(Value::as_str) {
            return name.to_string();
        }
        if let Some(tool) = raw.get("tool").and_then(Value::as_str) {
            return tool.to_string();
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::{
        build_openai_custom_tool_call_output_payload, build_openai_function_call_output_payload,
    };
    use serde_json::json;

    #[test]
    fn function_call_output_payload_serializes_object_result_as_string_output() {
        let payload = build_openai_function_call_output_payload(
            &json!({
                "status":"success",
                "provider_call_id":"call-1",
                "result":{"ok":true}
            }),
            None,
        );
        assert_eq!(payload["type"], "function_call_output");
        assert_eq!(payload["call_id"], "call-1");
        assert_eq!(payload["output"], "{\"ok\":true}");
    }

    #[test]
    fn custom_tool_call_output_payload_uses_custom_type() {
        let payload = build_openai_custom_tool_call_output_payload(
            &json!({
                "status":"success",
                "provider_call_id":"call-2",
                "result":{"output_text":"done"}
            }),
            None,
        );
        assert_eq!(payload["type"], "custom_tool_call_output");
        assert_eq!(payload["call_id"], "call-2");
        assert_eq!(payload["output"], "done");
    }
}
