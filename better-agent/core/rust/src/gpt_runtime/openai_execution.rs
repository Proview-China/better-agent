use serde::Deserialize;
use serde_json::{json, Value};

use crate::gpt_runtime::config::{
    CustomToolFormat, CustomToolSpec, FunctionToolSpec, GptRequestConfig, ShellToolKind,
    WebSearchConfig,
};
use crate::gpt_runtime::request::build_request;

#[derive(Debug, Deserialize)]
pub struct OpenAiExecutionContext {
    pub tool_name: String,
    #[serde(default)]
    pub tool_description: String,
    #[serde(default = "default_tool_parameters")]
    pub tool_parameters: Value,
    #[serde(default = "default_tool_constraints")]
    pub tool_constraints: Value,
    #[serde(default = "default_args")]
    pub args: Value,
    #[serde(default = "default_policy")]
    pub policy: Value,
    #[serde(default)]
    pub provider_call_id: String,
}

fn default_tool_parameters() -> Value {
    Value::Object(Default::default())
}

fn default_tool_constraints() -> Value {
    Value::Object(Default::default())
}

fn default_args() -> Value {
    Value::Object(Default::default())
}

fn default_policy() -> Value {
    Value::Object(Default::default())
}

fn string_field(obj: &Value, key: &str) -> Option<String> {
    obj.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn infer_tool_kind(tool_constraints: &Value, tool_name: &str) -> String {
    if let Some(kind) = string_field(tool_constraints, "tool_kind") {
        return kind;
    }
    if matches!(tool_name, "local_shell" | "shell" | "shell_command" | "exec_command") {
        return "shell".to_string();
    }
    "function".to_string()
}

fn is_custom_tool(tool_constraints: &Value, policy: &Value) -> bool {
    string_field(tool_constraints, "tool_type").as_deref() == Some("custom")
        || string_field(policy, "tool_type").as_deref() == Some("custom")
}

pub fn build_openai_request_from_execution(context: OpenAiExecutionContext) -> Value {
    let tool_kind = infer_tool_kind(&context.tool_constraints, &context.tool_name);
    let instructions = string_field(&context.policy, "user_prompt")
        .unwrap_or_else(|| "Please continue by calling the requested tool.".to_string());
    let model = string_field(&context.policy, "openai_model").unwrap_or_else(|| "gpt-4.1".to_string());
    let parallel_tool_calls = context
        .policy
        .get("parallel_tool_calls")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let mut config = GptRequestConfig {
        model,
        instructions,
        input_text: String::new(),
        input_items: Vec::new(),
        function_tools: Vec::new(),
        custom_tools: Vec::new(),
        shell_tool: None,
        web_search: None,
        js_repl_enabled: false,
        artifacts_enabled: false,
        view_image_enabled: false,
        mcp_resource_tools_enabled: false,
        hooks_enabled: false,
        skills_enabled: false,
        skill_roots: Vec::new(),
        ability_preset: None,
        tool_choice: context
            .policy
            .get("tool_choice")
            .cloned()
            .unwrap_or_else(|| Value::String("auto".to_string())),
        parallel_tool_calls,
        store: false,
        stream: false,
        text: crate::gpt_runtime::config::TextControls {
            verbosity: "low".to_string(),
        },
    };

    if tool_kind == "web" {
        config.input_text = context
            .args
            .get("query")
            .and_then(Value::as_str)
            .unwrap_or("Use web search.")
            .to_string();
        config.web_search = Some(WebSearchConfig {
            external_web_access: true,
            search_content_types: None,
        });
        return build_request(config);
    }

    if tool_kind == "shell" {
        let executor_target = string_field(&context.tool_constraints, "executor_target").unwrap_or_default();
        config.shell_tool = Some(if context.tool_name == "local_shell" {
            ShellToolKind::LocalShell
        } else if context.tool_name == "exec_command" || executor_target == "builtin.exec_command" {
            ShellToolKind::ExecCommand
        } else if context.tool_name == "shell_command" {
            ShellToolKind::ShellCommand
        } else {
            ShellToolKind::Shell
        });
        config.input_text = if context.tool_name == "local_shell" {
            "Use the provided local shell tool exactly once.".to_string()
        } else {
            "Use the provided shell tool exactly once.".to_string()
        };
        if context.policy.get("tool_choice").is_none() && context.tool_name != "local_shell" {
            config.tool_choice = json!({
                "type": "function",
                "name": context.tool_name
            });
        }
        return build_request(config);
    }

    if is_custom_tool(&context.tool_constraints, &context.policy) {
        config.custom_tools.push(CustomToolSpec {
            name: context.tool_name.clone(),
            description: context.tool_description,
            format: CustomToolFormat {
                tool_type: "grammar".to_string(),
                syntax: "lark".to_string(),
                definition: "start: /[\\s\\S]*/".to_string(),
            },
        });
        config.input_items.push(json!({
            "type": "custom_tool_call",
            "name": context.tool_name,
            "call_id": context.provider_call_id,
            "input": context.args.to_string()
        }));
        if context.policy.get("tool_choice").is_none() {
            config.tool_choice = json!({
                "type": "custom",
                "name": config.custom_tools[0].name
            });
        }
        return build_request(config);
    }

    config.function_tools.push(FunctionToolSpec {
        name: context.tool_name.clone(),
        description: context.tool_description,
        strict: false,
        parameters: context.tool_parameters,
    });
    config.input_items.push(json!({
        "type": "function_call",
        "name": context.tool_name,
        "call_id": context.provider_call_id,
        "arguments": context.args.to_string()
    }));
    if context.policy.get("tool_choice").is_none() {
        config.tool_choice = json!({
            "type": "function",
            "name": config.function_tools[0].name
        });
    }
    build_request(config)
}
