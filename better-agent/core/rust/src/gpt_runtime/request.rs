use serde_json::{json, Value};

use crate::gpt_runtime::code_tools::{build_artifacts_tool, build_js_repl_tool};
use crate::gpt_runtime::computer_tools::build_view_image_tool;
use crate::gpt_runtime::config::GptRequestConfig;
use crate::gpt_runtime::custom_tools::build_custom_tool;
use crate::gpt_runtime::function_tools::build_function_tool;
use crate::gpt_runtime::mcp_tools::{
    build_list_mcp_resource_templates_tool, build_list_mcp_resources_tool, build_read_mcp_resource_tool,
};
use crate::gpt_runtime::profiles::apply_ability_preset;
use crate::gpt_runtime::shell::build_shell_tool;
use crate::gpt_runtime::web_search::build_web_search_tool;

fn input_items(config: &GptRequestConfig) -> Vec<Value> {
    if !config.input_items.is_empty() {
        return config.input_items.clone();
    }
    vec![json!({
        "id": Value::Null,
        "role": "user",
        "content": [
            {
                "type": "input_text",
                "text": config.input_text,
            }
        ]
    })]
}

pub fn build_request(mut config: GptRequestConfig) -> Value {
    apply_ability_preset(&mut config);
    let mut tools = Vec::new();
    tools.extend(config.function_tools.iter().map(build_function_tool));
    tools.extend(config.custom_tools.iter().map(build_custom_tool));
    if let Some(shell_tool) = config.shell_tool {
        tools.push(build_shell_tool(shell_tool));
    }
    if let Some(web_search) = &config.web_search {
        tools.push(build_web_search_tool(web_search));
    }
    if config.js_repl_enabled {
        tools.push(build_js_repl_tool());
    }
    if config.artifacts_enabled {
        tools.push(build_artifacts_tool());
    }
    if config.view_image_enabled {
        tools.push(build_view_image_tool());
    }
    if config.mcp_resource_tools_enabled {
        tools.push(build_list_mcp_resources_tool());
        tools.push(build_list_mcp_resource_templates_tool());
        tools.push(build_read_mcp_resource_tool());
    }

    json!({
        "model": config.model,
        "instructions": config.instructions,
        "input": input_items(&config),
        "tools": tools,
        "tool_choice": config.tool_choice,
        "parallel_tool_calls": config.parallel_tool_calls,
        "store": config.store,
        "stream": config.stream,
        "text": {
            "verbosity": config.text.verbosity,
        }
    })
}
