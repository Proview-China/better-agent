use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum HookToolKind {
    Function,
    Custom,
    LocalShell,
    Mcp,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "input_type", rename_all = "snake_case")]
pub enum HookToolInput {
    Function { arguments: String },
    Custom { input: String },
    LocalShell { params: Value },
    Mcp { server: String, tool: String, arguments: String },
}

#[derive(Debug, Deserialize)]
pub struct AfterToolUseHookRequest {
    pub turn_id: String,
    pub call_id: String,
    pub tool_name: String,
    pub tool_kind: HookToolKind,
    pub tool_input: HookToolInput,
    pub executed: bool,
    pub success: bool,
    pub duration_ms: u64,
    pub mutating: bool,
    pub sandbox: String,
    pub sandbox_policy: String,
    pub output_preview: String,
}

pub fn build_after_tool_use_payload(request: AfterToolUseHookRequest) -> Value {
    json!({
        "event_type": "after_tool_use",
        "turn_id": request.turn_id,
        "call_id": request.call_id,
        "tool_name": request.tool_name,
        "tool_kind": request.tool_kind,
        "tool_input": request.tool_input,
        "executed": request.executed,
        "success": request.success,
        "duration_ms": request.duration_ms,
        "mutating": request.mutating,
        "sandbox": request.sandbox,
        "sandbox_policy": request.sandbox_policy,
        "output_preview": request.output_preview
    })
}
