use serde_json::{json, Value};

use crate::gpt_runtime::config::CustomToolSpec;

pub fn build_custom_tool(tool: &CustomToolSpec) -> Value {
    json!({
        "type": "custom",
        "name": tool.name,
        "description": tool.description,
        "format": {
            "type": tool.format.tool_type,
            "syntax": tool.format.syntax,
            "definition": tool.format.definition,
        }
    })
}
