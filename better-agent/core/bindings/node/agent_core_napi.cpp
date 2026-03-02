#include <node_api.h>
#include "agent_core.h"

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

/* ── Module registration ─────────────────────────────────────────────────── */
static napi_value ModuleInit(napi_env env, napi_value exports) {
    napi_property_descriptor props[] = {
        {"init",     nullptr, Init,     nullptr, nullptr, nullptr, napi_default, nullptr},
        {"shutdown", nullptr, Shutdown, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"version",  nullptr, Version,  nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props);
    return exports;
}

NAPI_MODULE(agent_core_napi, ModuleInit)
