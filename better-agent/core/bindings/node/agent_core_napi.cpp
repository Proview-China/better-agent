#include <node_api.h>
#include <string>

#include "agent_core.h"

namespace {

std::string get_string_arg(napi_env env, napi_value value) {
    napi_value string_value = value;
    if (napi_coerce_to_string(env, value, &string_value) != napi_ok) {
        return "";
    }

    size_t len = 0;
    if (napi_get_value_string_utf8(env, string_value, nullptr, 0, &len) != napi_ok) {
        return "";
    }

    // Allocate one extra byte for the C-string terminator required by N-API.
    std::string out(len + 1, '\0');
    size_t out_len = 0;
    if (napi_get_value_string_utf8(env, string_value, out.data(), out.size(), &out_len) != napi_ok) {
        return "";
    }
    out.resize(out_len);
    return out;
}

napi_value make_string(napi_env env, const char *value) {
    napi_value out;
    napi_create_string_utf8(env, value == nullptr ? "" : value, NAPI_AUTO_LENGTH, &out);
    return out;
}

} // namespace

/* ── agent_core.init() → number ──────────────────────────────────────────── */
static napi_value Init(napi_env env, napi_callback_info /*info*/) {
    int rc = agent_core_init();
    napi_value result;
    napi_create_int32(env, rc, &result);
    return result;
}

/* ── agent_core.shutdown() → undefined ───────────────────────────────────── */
static napi_value Shutdown(napi_env env, napi_callback_info /*info*/) {
    agent_core_shutdown();
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
}

/* ── agent_core.version() → string ───────────────────────────────────────── */
static napi_value Version(napi_env env, napi_callback_info /*info*/) {
    const char *ver = agent_core_version();
    napi_value result;
    napi_create_string_utf8(env, ver, NAPI_AUTO_LENGTH, &result);
    return result;
}

/* ── agent_core.normalizeRuntimeEvent(rawJson) → string ─────────────────── */
static napi_value NormalizeRuntimeEvent(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

    std::string raw = (argc > 0) ? get_string_arg(env, argv[0]) : "";

    const char *normalized = agent_core_normalize_runtime_event(raw.empty() ? nullptr : raw.c_str());
    return make_string(env, normalized);
}

/* ── agent_core.lastError() → string ─────────────────────────────────────── */
static napi_value LastError(napi_env env, napi_callback_info /*info*/) {
    const char *msg = agent_core_last_error();
    return make_string(env, msg);
}

/* ── agent_core.registerTool(toolDefJson) → number ───────────────────────── */
static napi_value RegisterTool(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

    std::string tool_def = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const int rc = agent_core_register_tool(tool_def.empty() ? nullptr : tool_def.c_str());

    napi_value result;
    napi_create_int32(env, rc, &result);
    return result;
}

/* ── agent_core.executeFunctionCall(modelJson, policyJson?) → string ─────── */
static napi_value ExecuteFunctionCall(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

    const std::string model = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const std::string policy = (argc > 1) ? get_string_arg(env, argv[1]) : "";

    const char *out = agent_core_execute_function_call(
        model.empty() ? nullptr : model.c_str(),
        policy.empty() ? nullptr : policy.c_str()
    );
    return make_string(env, out);
}

/* ── agent_core.getExecution(executionId) → string ───────────────────────── */
static napi_value GetExecution(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string id = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_get_execution(id.empty() ? nullptr : id.c_str());
    return make_string(env, out);
}

/* ── agent_core.interruptExecution(executionId) → string ─────────────────── */
static napi_value InterruptExecution(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string id = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_interrupt_execution(id.empty() ? nullptr : id.c_str());
    return make_string(env, out);
}

/* ── agent_core.sandboxProbe(requestJson?) → string ──────────────────────── */
static napi_value SandboxProbe(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string request = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_sandbox_probe(request.empty() ? nullptr : request.c_str());
    return make_string(env, out);
}

/* ── agent_core.executeOpenAIFunctionCall(modelJson, policyJson?) → string ─ */
static napi_value ExecuteOpenAIFunctionCall(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

    const std::string model = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const std::string policy = (argc > 1) ? get_string_arg(env, argv[1]) : "";
    const char *out = agent_core_execute_openai_function_call(
        model.empty() ? nullptr : model.c_str(),
        policy.empty() ? nullptr : policy.c_str()
    );
    return make_string(env, out);
}

/* ── agent_core.executeClaudeToolUse(modelJson, policyJson?) → string ────── */
static napi_value ExecuteClaudeToolUse(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

    const std::string model = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const std::string policy = (argc > 1) ? get_string_arg(env, argv[1]) : "";
    const char *out = agent_core_execute_claude_tool_use(
        model.empty() ? nullptr : model.c_str(),
        policy.empty() ? nullptr : policy.c_str()
    );
    return make_string(env, out);
}

/* ── agent_core.buildOpenAIFunctionCallOutput(execId, callId?) → string ──── */
static napi_value BuildOpenAIFunctionCallOutput(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string exec_id = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const std::string call_id = (argc > 1) ? get_string_arg(env, argv[1]) : "";
    const char *out = agent_core_build_openai_function_call_output(
        exec_id.empty() ? nullptr : exec_id.c_str(),
        call_id.empty() ? nullptr : call_id.c_str()
    );
    return make_string(env, out);
}

/* ── agent_core.buildClaudeToolResult(execId, toolUseId?) → string ───────── */
static napi_value BuildClaudeToolResult(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value argv[2];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string exec_id = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const std::string tool_use_id = (argc > 1) ? get_string_arg(env, argv[1]) : "";
    const char *out = agent_core_build_claude_tool_result(
        exec_id.empty() ? nullptr : exec_id.c_str(),
        tool_use_id.empty() ? nullptr : tool_use_id.c_str()
    );
    return make_string(env, out);
}

/* ── agent_core.memoryConfigure(configJson?) → string ────────────────────── */
static napi_value MemoryConfigure(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string config = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_memory_configure(config.empty() ? nullptr : config.c_str());
    return make_string(env, out);
}

/* ── agent_core.memoryIngest(inputJson) → string ─────────────────────────── */
static napi_value MemoryIngest(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string input = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_memory_ingest(input.empty() ? nullptr : input.c_str());
    return make_string(env, out);
}

/* ── agent_core.memoryQuery(queryJson) → string ──────────────────────────── */
static napi_value MemoryQuery(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string query = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_memory_query(query.empty() ? nullptr : query.c_str());
    return make_string(env, out);
}

/* ── agent_core.memoryGet(memoryId) → string ─────────────────────────────── */
static napi_value MemoryGet(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
    const std::string memory_id = (argc > 0) ? get_string_arg(env, argv[0]) : "";
    const char *out = agent_core_memory_get(memory_id.empty() ? nullptr : memory_id.c_str());
    return make_string(env, out);
}

/* ── agent_core.memoryReset() → string ───────────────────────────────────── */
static napi_value MemoryReset(napi_env env, napi_callback_info /*info*/) {
    const char *out = agent_core_memory_reset();
    return make_string(env, out);
}

/* ── Module registration ─────────────────────────────────────────────────── */
static napi_value ModuleInit(napi_env env, napi_value exports) {
    napi_property_descriptor props[] = {
        {"init",     nullptr, Init,     nullptr, nullptr, nullptr, napi_default, nullptr},
        {"shutdown", nullptr, Shutdown, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"version",  nullptr, Version,  nullptr, nullptr, nullptr, napi_default, nullptr},
        {"normalizeRuntimeEvent", nullptr, NormalizeRuntimeEvent, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"registerTool", nullptr, RegisterTool, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"executeFunctionCall", nullptr, ExecuteFunctionCall, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"getExecution", nullptr, GetExecution, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"interruptExecution", nullptr, InterruptExecution, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"sandboxProbe", nullptr, SandboxProbe, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"executeOpenAIFunctionCall", nullptr, ExecuteOpenAIFunctionCall, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"executeClaudeToolUse", nullptr, ExecuteClaudeToolUse, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"buildOpenAIFunctionCallOutput", nullptr, BuildOpenAIFunctionCallOutput, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"buildClaudeToolResult", nullptr, BuildClaudeToolResult, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"memoryConfigure", nullptr, MemoryConfigure, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"memoryIngest", nullptr, MemoryIngest, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"memoryQuery", nullptr, MemoryQuery, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"memoryGet", nullptr, MemoryGet, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"memoryReset", nullptr, MemoryReset, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"lastError", nullptr, LastError, nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props);
    return exports;
}

NAPI_MODULE(agent_core_napi, ModuleInit)
