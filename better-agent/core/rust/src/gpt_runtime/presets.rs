use serde_json::json;

use crate::gpt_runtime::config::{GptRequestConfig, TextControls, WebSearchConfig, ShellToolKind};

pub fn build_basic_abilities_config(model: String) -> GptRequestConfig {
    GptRequestConfig {
        model,
        instructions: "You are Codex. Be concise and use tools when appropriate.".to_string(),
        input_text: String::new(),
        input_items: Vec::new(),
        function_tools: Vec::new(),
        custom_tools: Vec::new(),
        shell_tool: Some(ShellToolKind::ShellCommand),
        web_search: Some(WebSearchConfig {
            external_web_access: true,
            search_content_types: None,
        }),
        js_repl_enabled: true,
        artifacts_enabled: true,
        view_image_enabled: true,
        mcp_resource_tools_enabled: true,
        hooks_enabled: true,
        skills_enabled: true,
        skill_roots: Vec::new(),
        ability_preset: None,
        tool_choice: json!("auto"),
        parallel_tool_calls: true,
        store: false,
        stream: false,
        text: TextControls {
            verbosity: "low".to_string(),
        },
    }
}
