use serde_json::{json, Value};

use crate::gpt_runtime::openai_provider::extract_provider_call_id;

pub fn build_provider_execution_wrapper(
    record: &Value,
    provider_payload: &Value,
    sdk_bundle: &Value,
) -> Value {
    json!({
        "execution": record,
        "provider_payload": provider_payload,
        "sdk": sdk_bundle
    })
}

pub fn build_claude_tool_result_payload(
    record: &Value,
    tool_use_id_override: Option<&str>,
) -> Value {
    let status = record.get("status").and_then(Value::as_str).unwrap_or("failed");
    let success = status == "success";
    let tool_use_id = tool_use_id_override
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| extract_provider_call_id(record));

    let body = if success {
        record.get("result").cloned().unwrap_or_else(|| json!({}))
    } else {
        json!({
            "status": status,
            "error": record.get("error").cloned().unwrap_or_else(|| json!({}))
        })
    };

    json!({
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "is_error": !success,
        "content": [
            {
                "type": "text",
                "text": body.to_string()
            }
        ]
    })
}
