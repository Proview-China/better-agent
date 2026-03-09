use crate::gpt_runtime::config::{AbilityPreset, GptRequestConfig, ShellToolKind, WebSearchConfig};

pub fn apply_ability_preset(config: &mut GptRequestConfig) {
    let Some(preset) = config.ability_preset else {
        return;
    };

    let enable_core4 = matches!(preset, AbilityPreset::Core4 | AbilityPreset::All8);
    let enable_ext4 = matches!(preset, AbilityPreset::Ext4 | AbilityPreset::All8);

    if enable_core4 {
        if config.web_search.is_none() {
            config.web_search = Some(WebSearchConfig {
                external_web_access: true,
                search_content_types: None,
            });
        }
        config.js_repl_enabled = true;
        config.artifacts_enabled = true;
        config.view_image_enabled = true;
    }

    if enable_ext4 {
        if config.shell_tool.is_none() {
            config.shell_tool = Some(ShellToolKind::LocalShell);
        }
        config.hooks_enabled = true;
        config.skills_enabled = true;
        config.mcp_resource_tools_enabled = true;
    }
}
