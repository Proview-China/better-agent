use serde_json::{json, Value};

use crate::gpt_runtime::config::FunctionToolSpec;

pub fn build_function_tool(tool: &FunctionToolSpec) -> Value {
    json!({
        "type": "function",
        "name": tool.name,
        "description": tool.description,
        "strict": tool.strict,
        "parameters": tool.parameters,
    })
}
