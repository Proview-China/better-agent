use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolOutputContentItem {
    InputText { text: String },
    InputImage {
        image_url: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ToolOutputBody {
    Text(String),
    ContentItems(Vec<ToolOutputContentItem>),
}

impl ToolOutputBody {
    pub fn to_wire_value(&self) -> Value {
        match self {
            Self::Text(text) => Value::String(text.clone()),
            Self::ContentItems(items) => serde_json::to_value(items).unwrap_or_else(|_| json!([])),
        }
    }
}

fn image_url_from_item(item: &Value) -> Option<String> {
    let image_url = item.get("image_url").and_then(Value::as_str);
    if let Some(image_url) = image_url {
        return Some(image_url.to_string());
    }

    let data = item.get("data").and_then(Value::as_str)?;
    if data.starts_with("data:") {
        return Some(data.to_string());
    }

    let mime_type = item
        .get("mimeType")
        .or_else(|| item.get("mime_type"))
        .and_then(Value::as_str)
        .unwrap_or("image/png");
    Some(format!("data:{mime_type};base64,{data}"))
}

fn normalize_content_item(item: &Value) -> Option<ToolOutputContentItem> {
    match item.get("type").and_then(Value::as_str) {
        Some("input_text") => item
            .get("text")
            .and_then(Value::as_str)
            .map(|text| ToolOutputContentItem::InputText {
                text: text.to_string(),
            }),
        Some("text") => item
            .get("text")
            .and_then(Value::as_str)
            .map(|text| ToolOutputContentItem::InputText {
                text: text.to_string(),
            }),
        Some("input_image") | Some("image") => image_url_from_item(item).map(|image_url| {
            ToolOutputContentItem::InputImage {
                image_url,
                detail: item.get("detail").and_then(Value::as_str).map(ToOwned::to_owned),
            }
        }),
        _ => None,
    }
}

pub fn build_tool_output_body(result: &Value, status: &str, error: &Value) -> ToolOutputBody {
    if let Some(items) = result.get("content_items").and_then(Value::as_array) {
        let normalized = items
            .iter()
            .filter_map(normalize_content_item)
            .collect::<Vec<_>>();
        if !normalized.is_empty() {
            return ToolOutputBody::ContentItems(normalized);
        }
    }

    if let Some(items) = result.as_array() {
        let normalized = items
            .iter()
            .filter_map(normalize_content_item)
            .collect::<Vec<_>>();
        if !normalized.is_empty() {
            return ToolOutputBody::ContentItems(normalized);
        }
    }

    if let Some(text) = result.get("output_text").and_then(Value::as_str) {
        return ToolOutputBody::Text(text.to_string());
    }

    if let Some(text) = result.as_str() {
        return ToolOutputBody::Text(text.to_string());
    }

    if status == "success" {
        return ToolOutputBody::Text(serde_json::to_string(result).unwrap_or_else(|_| "{}".to_string()));
    }

    let failure_body = json!({
        "status": status,
        "error": error
    });
    ToolOutputBody::Text(
        serde_json::to_string(&failure_body).unwrap_or_else(|_| "{\"status\":\"failed\"}".to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::{build_tool_output_body, ToolOutputBody, ToolOutputContentItem};
    use serde_json::json;

    #[test]
    fn serializes_plain_text_output() {
        let body = build_tool_output_body(&json!({"output_text":"ok"}), "success", &json!(null));
        assert_eq!(body, ToolOutputBody::Text("ok".to_string()));
    }

    #[test]
    fn serializes_content_items_output() {
        let body = build_tool_output_body(
            &json!({
                "content_items": [
                    {"type":"text","text":"caption"},
                    {"type":"image","data":"BASE64","mimeType":"image/png"}
                ]
            }),
            "success",
            &json!(null),
        );
        assert_eq!(
            body,
            ToolOutputBody::ContentItems(vec![
                ToolOutputContentItem::InputText {
                    text: "caption".to_string()
                },
                ToolOutputContentItem::InputImage {
                    image_url: "data:image/png;base64,BASE64".to_string(),
                    detail: None
                }
            ])
        );
    }

    #[test]
    fn serializes_object_result_as_json_text() {
        let body = build_tool_output_body(&json!({"ok":true,"value":1}), "success", &json!(null));
        assert_eq!(body, ToolOutputBody::Text("{\"ok\":true,\"value\":1}".to_string()));
    }
}
