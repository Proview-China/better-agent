use serde_json::{Map, Value};

use crate::gpt_runtime::config::WebSearchConfig;

pub fn build_web_search_tool(config: &WebSearchConfig) -> Value {
    let mut value = Map::new();
    value.insert("type".to_string(), Value::String("web_search".to_string()));
    value.insert(
        "external_web_access".to_string(),
        Value::Bool(config.external_web_access),
    );
    if let Some(content_types) = &config.search_content_types {
        value.insert(
            "search_content_types".to_string(),
            Value::Array(
                content_types
                    .iter()
                    .map(|content_type| Value::String(content_type.clone()))
                    .collect(),
            ),
        );
    }
    Value::Object(value)
}
