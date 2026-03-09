use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize, Clone, Copy)]
pub enum AbilityPreset {
    #[serde(rename = "core4", alias = "core_4")]
    Core4,
    #[serde(rename = "ext4", alias = "ext_4")]
    Ext4,
    #[serde(rename = "all8", alias = "all_8")]
    All8,
}

#[derive(Debug, Deserialize)]
pub struct GptRequestConfig {
    pub model: String,
    #[serde(default = "default_instructions")]
    pub instructions: String,
    #[serde(default)]
    pub input_text: String,
    #[serde(default)]
    pub input_items: Vec<Value>,
    #[serde(default)]
    pub function_tools: Vec<FunctionToolSpec>,
    #[serde(default)]
    pub custom_tools: Vec<CustomToolSpec>,
    #[serde(default)]
    pub shell_tool: Option<ShellToolKind>,
    #[serde(default)]
    pub web_search: Option<WebSearchConfig>,
    #[serde(default)]
    pub js_repl_enabled: bool,
    #[serde(default)]
    pub artifacts_enabled: bool,
    #[serde(default)]
    pub view_image_enabled: bool,
    #[serde(default)]
    pub mcp_resource_tools_enabled: bool,
    #[serde(default)]
    pub hooks_enabled: bool,
    #[serde(default)]
    pub skills_enabled: bool,
    #[serde(default)]
    pub skill_roots: Vec<String>,
    #[serde(default)]
    pub ability_preset: Option<AbilityPreset>,
    #[serde(default = "default_tool_choice")]
    pub tool_choice: Value,
    #[serde(default = "default_parallel_tool_calls")]
    pub parallel_tool_calls: bool,
    #[serde(default = "default_store")]
    pub store: bool,
    #[serde(default = "default_stream")]
    pub stream: bool,
    #[serde(default = "default_text_controls")]
    pub text: TextControls,
}

#[derive(Debug, Deserialize)]
pub struct FunctionToolSpec {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub strict: bool,
    pub parameters: Value,
}

#[derive(Debug, Deserialize)]
pub struct CustomToolSpec {
    pub name: String,
    pub description: String,
    pub format: CustomToolFormat,
}

#[derive(Debug, Deserialize)]
pub struct CustomToolFormat {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub syntax: String,
    pub definition: String,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum ShellToolKind {
    LocalShell,
    Shell,
    ShellCommand,
    ExecCommand,
}

#[derive(Debug, Deserialize)]
pub struct WebSearchConfig {
    #[serde(default = "default_external_web_access")]
    pub external_web_access: bool,
    #[serde(default)]
    pub search_content_types: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct TextControls {
    #[serde(default = "default_verbosity")]
    pub verbosity: String,
}

fn default_instructions() -> String {
    "You are Codex. Be concise and use tools when appropriate.".to_string()
}

fn default_tool_choice() -> Value {
    Value::String("auto".to_string())
}

fn default_parallel_tool_calls() -> bool {
    true
}

fn default_store() -> bool {
    false
}

fn default_stream() -> bool {
    false
}

fn default_text_controls() -> TextControls {
    TextControls {
        verbosity: default_verbosity(),
    }
}

fn default_verbosity() -> String {
    "low".to_string()
}

fn default_external_web_access() -> bool {
    true
}
