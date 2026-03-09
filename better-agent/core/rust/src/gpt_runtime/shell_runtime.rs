#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UnifiedShellRequest {
    pub tool_name: String,
    pub command: Vec<String>,
    pub workdir: Option<String>,
    pub timeout_ms: Option<u64>,
    pub justification: Option<String>,
    pub prefix_rule: Option<Vec<String>>,
    pub sandbox_permissions: Option<Value>,
    pub additional_permissions: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UnifiedShellResult {
    pub status: String,
    pub stdout: String,
    pub stderr: String,
    pub aggregated_output: String,
    pub exit_code: Option<i64>,
    pub duration_ms: Option<u64>,
    pub formatted_output: String,
}

pub fn normalize_shell_request(tool_name: &str, payload: &Value) -> Result<UnifiedShellRequest, Value> {
    match tool_name {
        "local_shell" => Ok(UnifiedShellRequest {
            tool_name: "local_shell".to_string(),
            command: payload
                .get("command")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect())
                .unwrap_or_default(),
            workdir: payload.get("workdir").and_then(Value::as_str).map(ToOwned::to_owned),
            timeout_ms: payload.get("timeout_ms").and_then(Value::as_u64),
            justification: payload.get("justification").and_then(Value::as_str).map(ToOwned::to_owned),
            prefix_rule: payload
                .get("prefix_rule")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect()),
            sandbox_permissions: payload.get("sandbox_permissions").cloned(),
            additional_permissions: payload.get("additional_permissions").cloned(),
        }),
        "shell" => Ok(UnifiedShellRequest {
            tool_name: "shell".to_string(),
            command: payload
                .get("command")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect())
                .unwrap_or_default(),
            workdir: payload.get("workdir").and_then(Value::as_str).map(ToOwned::to_owned),
            timeout_ms: payload.get("timeout_ms").and_then(Value::as_u64),
            justification: payload.get("justification").and_then(Value::as_str).map(ToOwned::to_owned),
            prefix_rule: payload
                .get("prefix_rule")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect()),
            sandbox_permissions: payload.get("sandbox_permissions").cloned(),
            additional_permissions: payload.get("additional_permissions").cloned(),
        }),
        "shell_command" => {
            let script = payload.get("command").and_then(Value::as_str).unwrap_or_default();
            Ok(UnifiedShellRequest {
                tool_name: "shell_command".to_string(),
                command: if script.is_empty() {
                    Vec::new()
                } else {
                    vec![script.to_string()]
                },
                workdir: payload.get("workdir").and_then(Value::as_str).map(ToOwned::to_owned),
                timeout_ms: payload.get("timeout_ms").and_then(Value::as_u64),
                justification: payload.get("justification").and_then(Value::as_str).map(ToOwned::to_owned),
                prefix_rule: payload
                    .get("prefix_rule")
                    .and_then(Value::as_array)
                    .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect()),
                sandbox_permissions: payload.get("sandbox_permissions").cloned(),
                additional_permissions: payload.get("additional_permissions").cloned(),
            })
        }
        _ => Err(json!({
            "error_code": "E_SHELL_TOOL",
            "message": "unsupported shell tool",
            "detail": { "tool_name": tool_name }
        })),
    }
}

pub fn build_shell_execution_result(output: &UnifiedShellResult) -> Value {
    json!({
        "status": output.status,
        "stdout": output.stdout,
        "stderr": output.stderr,
        "aggregated_output": output.aggregated_output,
        "exit_code": output.exit_code,
        "duration_ms": output.duration_ms,
        "formatted_output": output.formatted_output
    })
}

#[cfg(test)]
mod tests {
    use super::{build_shell_execution_result, normalize_shell_request, UnifiedShellResult};
    use serde_json::json;

    #[test]
    fn normalizes_local_shell_request() {
        let request = normalize_shell_request(
            "local_shell",
            &json!({
                "command":["bash","-lc","printf hi"],
                "workdir":"/tmp",
                "timeout_ms":1000,
                "justification":"test"
            }),
        )
        .expect("normalize local_shell");
        assert_eq!(request.command.len(), 3);
        assert_eq!(request.workdir.as_deref(), Some("/tmp"));
        assert_eq!(request.timeout_ms, Some(1000));
    }

    #[test]
    fn builds_shell_execution_result() {
        let result = build_shell_execution_result(&UnifiedShellResult {
            status: "success".to_string(),
            stdout: "hi".to_string(),
            stderr: String::new(),
            aggregated_output: "hi".to_string(),
            exit_code: Some(0),
            duration_ms: Some(12),
            formatted_output: "Exit code: 0\nOutput:\nhi".to_string(),
        });
        assert_eq!(result["stdout"], "hi");
        assert_eq!(result["exit_code"], 0);
        assert_eq!(result["duration_ms"], 12);
    }
}
