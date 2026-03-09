use serde_json::{json, Value};

use crate::gpt_runtime::config::ShellToolKind;

pub fn build_shell_tool(kind: ShellToolKind) -> Value {
    match kind {
        ShellToolKind::LocalShell => json!({
            "type": "local_shell"
        }),
        ShellToolKind::Shell => json!({
            "type": "function",
            "name": "shell",
            "description": "Runs a shell command and returns its output. Always set the workdir param when using the shell function. Do not use cd unless absolutely necessary.",
            "strict": false,
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "The command to execute"
                    },
                    "workdir": {
                        "type": "string",
                        "description": "The working directory to execute the command in"
                    },
                    "timeout_ms": {
                        "type": "number",
                        "description": "The timeout for the command in milliseconds"
                    },
                    "sandbox_permissions": {
                        "type": "object",
                        "description": "Sandbox policy to use for this shell call."
                    },
                    "prefix_rule": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Suggests a command prefix to persist for future sessions."
                    },
                    "additional_permissions": {
                        "type": "object",
                        "description": "Additional filesystem, network, or OS permissions requested for this shell call."
                    },
                    "justification": {
                        "type": "string",
                        "description": "Short explanation for why elevated access is needed."
                    }
                },
                "required": ["command"],
                "additionalProperties": false
            }
        }),
        ShellToolKind::ShellCommand => json!({
            "type": "function",
            "name": "shell_command",
            "description": "Runs a shell command and returns its output. Always set the workdir param when using the shell_command function. Do not use cd unless absolutely necessary.",
            "strict": false,
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell script to execute in the user's default shell"
                    },
                    "workdir": {
                        "type": "string",
                        "description": "The working directory to execute the command in"
                    },
                    "timeout_ms": {
                        "type": "number",
                        "description": "The timeout for the command in milliseconds"
                    },
                    "login": {
                        "type": "boolean",
                        "description": "Whether to run the shell with login shell semantics. Defaults to true."
                    },
                    "sandbox_permissions": {
                        "type": "object",
                        "description": "Sandbox policy to use for this shell call."
                    },
                    "prefix_rule": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Suggests a command prefix to persist for future sessions."
                    },
                    "additional_permissions": {
                        "type": "object",
                        "description": "Additional filesystem, network, or OS permissions requested for this shell call."
                    },
                    "justification": {
                        "type": "string",
                        "description": "Short explanation for why elevated access is needed."
                    }
                },
                "required": ["command"],
                "additionalProperties": false
            }
        }),
        ShellToolKind::ExecCommand => json!({
            "type": "function",
            "name": "exec_command",
            "description": "Runs a command in a PTY, returning output or a session ID for ongoing interaction.",
            "strict": false,
            "parameters": {
                "type": "object",
                "properties": {
                    "cmd": {
                        "type": "string",
                        "description": "Shell command to execute."
                    },
                    "workdir": {
                        "type": "string",
                        "description": "Optional working directory to run the command in; defaults to the turn cwd."
                    },
                    "shell": {
                        "type": "string",
                        "description": "Shell binary to launch. Defaults to the user's default shell."
                    },
                    "tty": {
                        "type": "boolean",
                        "description": "Whether to allocate a TTY for the command."
                    },
                    "yield_time_ms": {
                        "type": "number",
                        "description": "How long to wait in milliseconds for output before yielding."
                    },
                    "max_output_tokens": {
                        "type": "number",
                        "description": "Maximum number of tokens to return."
                    },
                    "sandbox_permissions": {
                        "type": "object",
                        "description": "Sandbox policy to use for this shell call."
                    },
                    "prefix_rule": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Suggests a command prefix to persist for future sessions."
                    },
                    "additional_permissions": {
                        "type": "object",
                        "description": "Additional filesystem, network, or OS permissions requested for this shell call."
                    },
                    "justification": {
                        "type": "string",
                        "description": "Short explanation for why elevated access is needed."
                    }
                },
                "required": ["cmd"],
                "additionalProperties": false
            }
        }),
    }
}
