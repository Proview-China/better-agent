use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use serde_json::{json, Value};

use crate::gpt_runtime::config::GptRequestConfig;
use crate::gpt_runtime::hooks::AfterToolUseHookRequest;
use crate::gpt_runtime::hooks::build_after_tool_use_payload;
use crate::gpt_runtime::mock::{build_mock_execution_result, resolve_mock_result};
use crate::gpt_runtime::execution::{build_execution_record, build_tool_execution_request};
use crate::gpt_runtime::executors::{
    builtin_executor_missing, native_executor_unavailable, resolve_executor_target,
};
use crate::gpt_runtime::openai_execution::OpenAiExecutionContext;
use crate::gpt_runtime::openai_execution::build_openai_request_from_execution;
use crate::gpt_runtime::openai_provider::{
    build_openai_custom_tool_call_output_payload, build_openai_function_call_output_payload,
    extract_provider_call_id, extract_tool_name,
};
use crate::gpt_runtime::payload_normalization::normalize_tool_payload;
use crate::gpt_runtime::parsing::parse_json_object_text;
use crate::gpt_runtime::policy::{build_policy_view, parse_policy_json};
use crate::gpt_runtime::provider_common::{
    build_claude_tool_result_payload, build_provider_execution_wrapper,
};
use crate::gpt_runtime::profiles::apply_ability_preset;
use crate::gpt_runtime::registry::parse_tool_definition;
use crate::gpt_runtime::presets::build_basic_abilities_config;
use crate::gpt_runtime::request::build_request;
use crate::gpt_runtime::request_prep::prepare_function_call_request;
use crate::gpt_runtime::runtime_capabilities::build_runtime_capabilities;
use crate::gpt_runtime::runtime_normalization::normalize_runtime_event;
use crate::gpt_runtime::skills::SkillMetadata;
use crate::gpt_runtime::skills::render_skills_section;
use crate::gpt_runtime::validation::{schema_validate_args, validate_tool_call_policy};

thread_local! {
    static LAST_ERROR: RefCell<Option<CString>> = const { RefCell::new(None) };
    static LAST_OUTPUT: RefCell<Option<CString>> = const { RefCell::new(None) };
}

const VERSION_BYTES: &[u8] = b"0.1.0\0";

fn set_tls_json(
    slot: &'static std::thread::LocalKey<RefCell<Option<CString>>>,
    value: Value,
) -> *const c_char {
    let serialized = value.to_string();
    let cstring = CString::new(serialized).expect("json output must not contain interior nulls");
    slot.with(|cell| {
        *cell.borrow_mut() = Some(cstring);
        cell.borrow()
            .as_ref()
            .map_or(std::ptr::null(), |stored| stored.as_ptr())
    })
}

fn set_error(code: &str, message: &str, detail: Value) -> *const c_char {
    let error = json!({
        "error_code": code,
        "message": message,
        "detail": detail,
    });
    set_tls_json(&LAST_ERROR, error.clone());
    set_tls_json(
        &LAST_OUTPUT,
        json!({
            "status": "failed",
            "error": error,
        }),
    )
}

fn read_arg_json(ptr: *const c_char, arg_name: &str) -> Result<Value, *const c_char> {
    if ptr.is_null() {
        return Err(set_error("E_INPUT", &format!("{arg_name} is null"), Value::Null));
    }
    let text = unsafe { CStr::from_ptr(ptr) };
    let text = match text.to_str() {
        Ok(value) => value,
        Err(_) => {
            return Err(set_error(
                "E_INPUT",
                &format!("{arg_name} must be valid UTF-8"),
                Value::Null,
            ));
        }
    };
    match serde_json::from_str::<Value>(text) {
        Ok(value) => Ok(value),
        Err(err) => Err(set_error(
            "E_INPUT",
            &format!("{arg_name} must be valid JSON"),
            json!({ "parse_error": err.to_string() }),
        )),
    }
}

#[no_mangle]
pub extern "C" fn better_agent_rs_version() -> *const c_char {
    VERSION_BYTES.as_ptr() as *const c_char
}

#[no_mangle]
pub extern "C" fn better_agent_rs_last_error() -> *const c_char {
    LAST_ERROR.with(|cell| {
        cell.borrow()
            .as_ref()
            .map_or(std::ptr::null(), |stored| stored.as_ptr())
    })
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_gpt_responses_request(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let parsed = match serde_json::from_value::<GptRequestConfig>(input) {
        Ok(config) => config,
        Err(err) => {
            return set_error(
                "E_RUST_RUNTIME_INPUT",
                "request_json does not match GPT runtime config schema",
                json!({ "parse_error": err.to_string() }),
            );
        }
    };

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, build_request(parsed))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_openai_request_from_execution(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let parsed = match serde_json::from_value::<OpenAiExecutionContext>(input) {
        Ok(config) => config,
        Err(err) => {
            return set_error(
                "E_RUST_RUNTIME_INPUT",
                "request_json does not match OpenAI execution context schema",
                json!({ "parse_error": err.to_string() }),
            );
        }
    };

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, build_openai_request_from_execution(parsed))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_gpt_toolset(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let mut parsed = match serde_json::from_value::<GptRequestConfig>(input) {
        Ok(config) => config,
        Err(err) => {
            return set_error(
                "E_RUST_RUNTIME_INPUT",
                "request_json does not match GPT runtime config schema",
                json!({ "parse_error": err.to_string() }),
            );
        }
    };

    apply_ability_preset(&mut parsed);
    let runtime_capabilities = build_runtime_capabilities(&parsed);
    let request = build_request(parsed);
    let tools = request.get("tools").cloned().unwrap_or_else(|| Value::Array(vec![]));
    let output = json!({
        "status": "success",
        "runtime": "rust",
        "tools": tools,
        "tool_count": tools.as_array().map_or(0, |items| items.len()),
        "runtime_capabilities": runtime_capabilities,
    });

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, output)
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_gpt_basic_abilities(
    model_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(model_json, "model_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let model = input
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("gpt-5.4")
        .to_string();

    let config = build_basic_abilities_config(model);
    let runtime_capabilities = build_runtime_capabilities(&config);
    let request = build_request(config);
    let tools = request.get("tools").cloned().unwrap_or_else(|| Value::Array(vec![]));
    let output = json!({
        "status": "success",
        "runtime": "rust",
        "preset": "gpt_basic_abilities",
        "tools": tools,
        "tool_count": tools.as_array().map_or(0, |items| items.len()),
        "runtime_capabilities": runtime_capabilities,
    });

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, output)
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_after_tool_use_hook_payload(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let parsed = match serde_json::from_value::<AfterToolUseHookRequest>(input) {
        Ok(config) => config,
        Err(err) => {
            return set_error(
                "E_RUST_RUNTIME_INPUT",
                "request_json does not match after_tool_use hook schema",
                json!({ "parse_error": err.to_string() }),
            );
        }
    };

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, build_after_tool_use_payload(parsed))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_render_skills_section(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let parsed = match serde_json::from_value::<Vec<SkillMetadata>>(input) {
        Ok(config) => config,
        Err(err) => {
            return set_error(
                "E_RUST_RUNTIME_INPUT",
                "request_json does not match skills metadata array schema",
                json!({ "parse_error": err.to_string() }),
            );
        }
    };

    let rendered = render_skills_section(&parsed).unwrap_or_default();
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        json!({
            "status": "success",
            "runtime": "rust",
            "rendered": rendered
        }),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_openai_function_call_output_payload(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let record = input.get("record").cloned().unwrap_or(Value::Object(Default::default()));
    let call_id_override = input.get("call_id_override").and_then(Value::as_str);

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        build_openai_function_call_output_payload(&record, call_id_override),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_openai_bridge_outputs(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };

    let record = input.get("record").cloned().unwrap_or(Value::Object(Default::default()));
    let tool_name = extract_tool_name(&record);
    let provider_call_id = extract_provider_call_id(&record);
    let tool_description = input
        .get("tool_description")
        .cloned()
        .unwrap_or_else(|| Value::String(String::new()));
    let tool_parameters = input
        .get("tool_parameters")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let tool_constraints = input
        .get("tool_constraints")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let policy = input
        .get("policy")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let args = record
        .get("input_normalized")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));

    let request = build_openai_request_from_execution(OpenAiExecutionContext {
        tool_name: tool_name.clone(),
        tool_description: tool_description.as_str().unwrap_or_default().to_string(),
        tool_parameters,
        tool_constraints,
        args,
        policy,
        provider_call_id: provider_call_id.clone(),
    });

    let is_custom_tool = input
        .get("tool_constraints")
        .and_then(Value::as_object)
        .and_then(|constraints| constraints.get("tool_type"))
        .and_then(Value::as_str)
        == Some("custom")
        || record
            .get("input_raw")
            .and_then(Value::as_object)
            .and_then(|raw| raw.get("type"))
            .and_then(Value::as_str)
            == Some("custom_tool_call");

    let provider_payload = if is_custom_tool {
        build_openai_custom_tool_call_output_payload(&record, None)
    } else {
        build_openai_function_call_output_payload(&record, None)
    };

    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        json!({
            "status": "success",
            "runtime": "rust",
            "tool_name": tool_name,
            "provider_call_id": provider_call_id,
            "provider_payload": provider_payload,
            "request": request
        }),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_extract_provider_call_id(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let record = input.get("record").cloned().unwrap_or(Value::Object(Default::default()));
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        json!({
            "status": "success",
            "value": extract_provider_call_id(&record)
        }),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_extract_tool_name(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let record = input.get("record").cloned().unwrap_or(Value::Object(Default::default()));
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        json!({
            "status": "success",
            "value": extract_tool_name(&record)
        }),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_claude_tool_result_payload(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let record = input.get("record").cloned().unwrap_or(Value::Object(Default::default()));
    let tool_use_id_override = input.get("tool_use_id_override").and_then(Value::as_str);
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        build_claude_tool_result_payload(&record, tool_use_id_override),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_provider_execution_wrapper(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let record = input.get("record").cloned().unwrap_or(Value::Object(Default::default()));
    let provider_payload = input.get("provider_payload").cloned().unwrap_or(Value::Object(Default::default()));
    let sdk_bundle = input.get("sdk_bundle").cloned().unwrap_or(Value::Object(Default::default()));
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        build_provider_execution_wrapper(&record, &provider_payload, &sdk_bundle),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_normalize_runtime_event(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, normalize_runtime_event(&input))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_parse_tool_definition(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    match parse_tool_definition(input) {
        Ok(parsed) => {
            LAST_ERROR.with(|cell| {
                *cell.borrow_mut() = None;
            });
            set_tls_json(&LAST_OUTPUT, parsed)
        }
        Err(err) => set_error(
            err.get("error_code").and_then(Value::as_str).unwrap_or("E_TOOL_DEF"),
            err.get("message").and_then(Value::as_str).unwrap_or("tool definition parse failed"),
            err.get("detail").cloned().unwrap_or(Value::Null),
        ),
    }
}

#[no_mangle]
pub extern "C" fn better_agent_rs_normalize_tool_payload(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    match normalize_tool_payload(&input) {
        Ok(parsed) => {
            LAST_ERROR.with(|cell| {
                *cell.borrow_mut() = None;
            });
            set_tls_json(&LAST_OUTPUT, parsed)
        }
        Err(err) => set_error(
            err.get("error_code").and_then(Value::as_str).unwrap_or("E_PARSE"),
            err.get("message").and_then(Value::as_str).unwrap_or("payload normalization failed"),
            err.get("detail").cloned().unwrap_or(Value::Null),
        ),
    }
}

#[no_mangle]
pub extern "C" fn better_agent_rs_schema_validate_args(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let args = input.get("args").cloned().unwrap_or(Value::Object(Default::default()));
    let schema = input.get("schema").cloned().unwrap_or(Value::Object(Default::default()));
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, schema_validate_args(&args, &schema))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_validate_tool_call_policy(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let tool_name = input.get("tool_name").and_then(Value::as_str).unwrap_or_default();
    let allow_tools: Vec<String> = input
        .get("allow_tools")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect())
        .unwrap_or_default();
    let deny_tools: Vec<String> = input
        .get("deny_tools")
        .and_then(Value::as_array)
        .map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect())
        .unwrap_or_default();
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, validate_tool_call_policy(tool_name, &allow_tools, &deny_tools))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_tool_execution_request(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let tool = input.get("tool").cloned().unwrap_or(Value::Object(Default::default()));
    let call = input.get("call").cloned().unwrap_or(Value::Object(Default::default()));
    let policy = input.get("policy").cloned().unwrap_or(Value::Object(Default::default()));
    let execution_id = input.get("execution_id").and_then(Value::as_str).unwrap_or_default();
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, build_tool_execution_request(&tool, &call, &policy, execution_id))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_execution_record(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let tool = input.get("tool").cloned().unwrap_or(Value::Object(Default::default()));
    let call = input.get("call").cloned().unwrap_or(Value::Object(Default::default()));
    let policy = input.get("policy").cloned().unwrap_or(Value::Object(Default::default()));
    let execution = input.get("execution").cloned().unwrap_or(Value::Object(Default::default()));
    let execution_id = input.get("execution_id").and_then(Value::as_str).unwrap_or_default();
    let timestamp = input.get("timestamp").and_then(Value::as_str).unwrap_or_default();
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        build_execution_record(&tool, &call, &policy, execution_id, &execution, timestamp),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_resolve_executor_target(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(
        &LAST_OUTPUT,
        json!({
            "status": "success",
            "value": resolve_executor_target(&input)
        }),
    )
}

#[no_mangle]
pub extern "C" fn better_agent_rs_builtin_executor_missing(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let executor_target = input.get("executor_target").and_then(Value::as_str).unwrap_or_default();
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, builtin_executor_missing(executor_target))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_native_executor_unavailable(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let executor_target = input.get("executor_target").and_then(Value::as_str).unwrap_or_default();
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, native_executor_unavailable(executor_target))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_resolve_mock_result(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let mock_result = input.get("mock_result").cloned().unwrap_or(Value::Object(Default::default()));
    let args = input.get("args").cloned().unwrap_or(Value::Object(Default::default()));
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, resolve_mock_result(&mock_result, &args))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_mock_execution_result(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let mock_result = input.get("mock_result").cloned().unwrap_or(Value::Object(Default::default()));
    let args = input.get("args").cloned().unwrap_or(Value::Object(Default::default()));
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, build_mock_execution_result(&mock_result, &args))
}

#[no_mangle]
pub extern "C" fn better_agent_rs_parse_policy_json(
    policy_json: *const c_char,
) -> *const c_char {
    let raw = if policy_json.is_null() {
        None
    } else {
        match unsafe { CStr::from_ptr(policy_json) }.to_str() {
            Ok(value) => Some(value),
            Err(_) => {
                return set_error(
                    "E_POLICY_PARSE",
                    "policy_json must be valid UTF-8",
                    Value::Null,
                );
            }
        }
    };
    match parse_policy_json(raw) {
        Ok(parsed) => {
            LAST_ERROR.with(|cell| {
                *cell.borrow_mut() = None;
            });
            set_tls_json(&LAST_OUTPUT, parsed)
        }
        Err(err) => set_error(
            err.get("error_code").and_then(Value::as_str).unwrap_or("E_POLICY_PARSE"),
            err.get("message").and_then(Value::as_str).unwrap_or("policy parse failed"),
            err.get("detail").cloned().unwrap_or(Value::Null),
        ),
    }
}

#[no_mangle]
pub extern "C" fn better_agent_rs_parse_model_output_json(
    raw_json: *const c_char,
) -> *const c_char {
    let raw = if raw_json.is_null() {
        return set_error("E_PARSE", "invalid model_output_json", Value::Null);
    } else {
        match unsafe { CStr::from_ptr(raw_json) }.to_str() {
            Ok(value) => value,
            Err(_) => {
                return set_error(
                    "E_PARSE",
                    "invalid model_output_json",
                    json!("model_output_json must be valid UTF-8"),
                );
            }
        }
    };
    match parse_json_object_text(raw, "model_output_json") {
        Ok(parsed) => {
            LAST_ERROR.with(|cell| {
                *cell.borrow_mut() = None;
            });
            set_tls_json(&LAST_OUTPUT, parsed)
        }
        Err(err) => set_error(
            err.get("error_code").and_then(Value::as_str).unwrap_or("E_PARSE"),
            err.get("message").and_then(Value::as_str).unwrap_or("invalid model_output_json"),
            err.get("detail").cloned().unwrap_or(Value::Null),
        ),
    }
}

#[no_mangle]
pub extern "C" fn better_agent_rs_prepare_function_call_request(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    let model_output_json = input
        .get("model_output_json")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let policy_json = input.get("policy_json").and_then(Value::as_str);
    match prepare_function_call_request(model_output_json, policy_json) {
        Ok(parsed) => {
            LAST_ERROR.with(|cell| {
                *cell.borrow_mut() = None;
            });
            set_tls_json(&LAST_OUTPUT, parsed)
        }
        Err(err) => set_error(
            err.get("error_code").and_then(Value::as_str).unwrap_or("E_PARSE"),
            err.get("message").and_then(Value::as_str).unwrap_or("prepare function call request failed"),
            err.get("detail").cloned().unwrap_or(Value::Null),
        ),
    }
}

#[no_mangle]
pub extern "C" fn better_agent_rs_build_policy_view(
    request_json: *const c_char,
) -> *const c_char {
    let input = match read_arg_json(request_json, "request_json") {
        Ok(value) => value,
        Err(ptr) => return ptr,
    };
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    set_tls_json(&LAST_OUTPUT, build_policy_view(&input))
}
