use serde_json::{json, Value};

use crate::gpt_runtime::config::GptRequestConfig;

pub fn build_runtime_capabilities(config: &GptRequestConfig) -> Value {
    json!({
        "hooks": {
            "enabled": config.hooks_enabled,
            "event_types": if config.hooks_enabled {
                vec!["after_agent", "after_tool_use"]
            } else {
                Vec::<&str>::new()
            },
            "tool_kinds": if config.hooks_enabled {
                vec!["function", "custom", "local_shell", "mcp"]
            } else {
                Vec::<&str>::new()
            }
        },
        "skills": {
            "enabled": config.skills_enabled,
            "injection_mode": if config.skills_enabled { "prompt_and_mentions" } else { "disabled" },
            "skill_roots": config.skill_roots
        }
    })
}
