use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use serde_json::{json, Value};

use crate::gpt_runtime::config::GptRequestConfig;
use crate::gpt_runtime::hooks::AfterToolUseHookRequest;
use crate::gpt_runtime::hooks::build_after_tool_use_payload;
use crate::gpt_runtime::openai_execution::OpenAiExecutionContext;
use crate::gpt_runtime::openai_execution::build_openai_request_from_execution;
use crate::gpt_runtime::openai_provider::{
    build_openai_function_call_output_payload, extract_provider_call_id, extract_tool_name,
};
use crate::gpt_runtime::provider_common::{
    build_claude_tool_result_payload, build_provider_execution_wrapper,
};
use crate::gpt_runtime::presets::build_basic_abilities_config;
use crate::gpt_runtime::request::build_request;
use crate::gpt_runtime::runtime_capabilities::build_runtime_capabilities;
use crate::gpt_runtime::skills::SkillMetadata;
use crate::gpt_runtime::skills::render_skills_section;

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

    let provider_payload = build_openai_function_call_output_payload(&record, None);

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
