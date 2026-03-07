#include "agent_core.h"
#include "tool_call_sdk_bridge.hpp"
#include "internal/agent_core_internal.hpp"

namespace {

using json = nlohmann::json;
namespace core_internal = better_agent::core_internal;

bool parse_json_object_arg(const char *json_text, const char *field_name, json *out, json *err_out) {
    *out = json::object();
    *err_out = nullptr;

    if (json_text == nullptr) {
        return true;
    }

    try {
        const json parsed = json::parse(json_text);
        if (!parsed.is_object()) {
            *err_out = core_internal::make_error_json(
                "E_PARSE",
                std::string(field_name) + " must be a JSON object"
            );
            return false;
        }
        *out = parsed;
        return true;
    } catch (const std::exception &e) {
        *err_out = core_internal::make_error_json(
            "E_PARSE",
            std::string("invalid ") + field_name,
            e.what()
        );
        return false;
    }
}

const char *fail_memory_api(const json &err) {
    core_internal::g_last_error = err.dump();
    core_internal::g_last_output = json{
        {"status", "failed"},
        {"error", err}
    }.dump();
    return core_internal::g_last_output.c_str();
}

bool enrich_execution_record_input(json *input, json *err_out) {
    if (!input->is_object()) {
        *err_out = core_internal::make_error_json(
            "E_MEMORY_INPUT",
            "memory_input_json must be a JSON object"
        );
        return false;
    }
    if (core_internal::get_string_or(*input, "input_type") != "execution_record") {
        return true;
    }
    if (input->contains("record") && (*input).at("record").is_object() && !(*input).at("record").empty()) {
        return true;
    }

    const std::string execution_id = core_internal::get_string_or(*input, "execution_id");
    if (execution_id.empty()) {
        return true;
    }

    std::lock_guard<std::mutex> lk(core_internal::g_tools_mu);
    if (!core_internal::g_executions.contains(execution_id)) {
        *err_out = core_internal::make_error_json(
            "E_NOT_FOUND",
            "execution record not found",
            json{{"execution_id", execution_id}}
        );
        return false;
    }
    (*input)["record"] = core_internal::serialize_execution_record(core_internal::g_executions.at(execution_id));
    return true;
}

} // namespace

int agent_core_init(void) {
    std::scoped_lock lk(core_internal::g_tools_mu, core_internal::g_memory_mu);
    core_internal::g_tools.clear();
    core_internal::g_executions.clear();
    core_internal::g_idempotency_to_execution.clear();
    core_internal::g_idempotency_signature.clear();
    core_internal::reset_memory_state_locked();
    return 0;
}

void agent_core_shutdown(void) {
    std::scoped_lock lk(core_internal::g_tools_mu, core_internal::g_memory_mu);
    core_internal::g_tools.clear();
    core_internal::g_executions.clear();
    core_internal::g_idempotency_to_execution.clear();
    core_internal::g_idempotency_signature.clear();
    core_internal::reset_memory_state_locked();
}

const char *agent_core_version(void) {
    return "0.3.0";
}

int agent_core_register_tool(const char *tool_definition_json) {
    core_internal::g_last_error.clear();
    if (tool_definition_json == nullptr) {
        core_internal::g_last_error = R"({"error_code":"E_INPUT","message":"tool_definition_json is null"})";
        return 1;
    }

    try {
        core_internal::ToolRegistration tool;
        if (!core_internal::parse_tool_registration_json(tool_definition_json, &tool)) {
            return 2;
        }

        std::lock_guard<std::mutex> lk(core_internal::g_tools_mu);
        core_internal::g_tools[tool.spec.name] = std::move(tool);
        return 0;
    } catch (const std::exception &e) {
        core_internal::g_last_error = json{
            {"error_code", "E_PARSE"},
            {"message", "invalid tool definition json"},
            {"detail", e.what()}
        }.dump();
        return 3;
    }
}

const char *agent_core_execute_function_call(const char *model_output_json, const char *policy_json) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (model_output_json == nullptr) {
        core_internal::g_last_output = json{
            {"status", "failed"},
            {"error", json{{"error_code", "E_INPUT"}, {"message", "model_output_json is null"}}}
        }.dump();
        return core_internal::g_last_output.c_str();
    }

    try {
        core_internal::PolicyView policy;
        core_internal::NormalizedCall normalized;
        if (!core_internal::prepare_function_call_request(model_output_json, policy_json, &policy, &normalized)) {
            return core_internal::g_last_output.c_str();
        }

        core_internal::execute_prepared_function_call_locked(policy, normalized);
        return core_internal::g_last_output.c_str();
    } catch (const std::exception &e) {
        core_internal::fail_function_call(json{
            {"error_code", "E_PARSE"},
            {"message", "invalid model_output_json"},
            {"detail", e.what()}
        });
        return core_internal::g_last_output.c_str();
    }
}

const char *agent_core_execute_openai_function_call(const char *openai_function_call_json, const char *policy_json) {
    const char *record_str = agent_core_execute_function_call(openai_function_call_json, policy_json);
    try {
        const json record_json = json::parse(record_str == nullptr ? "{}" : record_str);
        const core_internal::ExecutionRecord record = core_internal::deserialize_execution_record(record_json);
        const json policy = core_internal::parse_optional_object_json(policy_json);
        const std::string tool_name = core_internal::extract_tool_name_from_record(record);

        std::string tool_description;
        json tool_parameters = json::object();
        json tool_constraints = json::object();
        core_internal::load_registered_tool_metadata(
            tool_name,
            &tool_description,
            &tool_parameters,
            &tool_constraints
        );

        const json sdk_bundle = better_agent::sdk_bridge::build_openai_bundle(
            tool_name,
            tool_description,
            tool_parameters,
            tool_constraints,
            record.input_normalized,
            policy,
            core_internal::extract_provider_call_id(record)
        );

        json out = core_internal::build_provider_execution_wrapper(
            record_json,
            core_internal::build_openai_function_call_output_payload(record, ""),
            sdk_bundle
        );
        core_internal::g_last_output = out.dump();
        return core_internal::g_last_output.c_str();
    } catch (...) {
        return record_str;
    }
}

const char *agent_core_execute_claude_tool_use(const char *claude_tool_use_json, const char *policy_json) {
    const char *record_str = agent_core_execute_function_call(claude_tool_use_json, policy_json);
    try {
        const json record_json = json::parse(record_str == nullptr ? "{}" : record_str);
        const core_internal::ExecutionRecord record = core_internal::deserialize_execution_record(record_json);
        const json policy = core_internal::parse_optional_object_json(policy_json);
        const std::string tool_name = core_internal::extract_tool_name_from_record(record);

        std::string tool_description;
        json tool_parameters = json::object();
        json tool_constraints = json::object();
        core_internal::load_registered_tool_metadata(
            tool_name,
            &tool_description,
            &tool_parameters,
            &tool_constraints
        );

        const json sdk_bundle = better_agent::sdk_bridge::build_claude_bundle(
            tool_name,
            tool_description,
            tool_parameters,
            tool_constraints,
            record.input_normalized,
            policy,
            core_internal::extract_provider_call_id(record)
        );

        json out = core_internal::build_provider_execution_wrapper(
            record_json,
            core_internal::build_claude_tool_result_payload(record, ""),
            sdk_bundle
        );
        core_internal::g_last_output = out.dump();
        return core_internal::g_last_output.c_str();
    } catch (...) {
        return record_str;
    }
}

const char *agent_core_get_execution(const char *execution_id) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();
    if (execution_id == nullptr) {
        const json err{
            {"error_code", "E_INPUT"},
            {"message", "execution_id is null"}
        };
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    std::lock_guard<std::mutex> lk(core_internal::g_tools_mu);
    const std::string id = execution_id;
    if (!core_internal::g_executions.contains(id)) {
        const json err{
            {"error_code", "E_NOT_FOUND"},
            {"message", "execution not found"},
            {"detail", json{{"execution_id", id}}}
        };
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    core_internal::g_last_output = core_internal::serialize_execution_record(core_internal::g_executions.at(id)).dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_interrupt_execution(const char *execution_id) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (execution_id == nullptr) {
        const json err{
            {"error_code", "E_INPUT"},
            {"message", "execution_id is null"}
        };
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    json err;
    const json out = core_internal::interrupt_execution(execution_id, &err);
    if (!err.is_null()) {
        return fail_memory_api(err);
    }
    core_internal::g_last_output = out.dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_build_openai_function_call_output(
    const char *execution_id,
    const char *call_id_override
) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (execution_id == nullptr) {
        const json err{{"error_code", "E_INPUT"}, {"message", "execution_id is null"}};
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    std::lock_guard<std::mutex> lk(core_internal::g_tools_mu);
    const std::string id = execution_id;
    if (!core_internal::g_executions.contains(id)) {
        const json err{
            {"error_code", "E_NOT_FOUND"},
            {"message", "execution not found"},
            {"detail", json{{"execution_id", id}}}
        };
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    const core_internal::ExecutionRecord &record = core_internal::g_executions.at(id);
    const std::string call_id = (call_id_override == nullptr) ? "" : std::string(call_id_override);
    core_internal::g_last_output = core_internal::build_openai_function_call_output_payload(record, call_id).dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_build_claude_tool_result(
    const char *execution_id,
    const char *tool_use_id_override
) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (execution_id == nullptr) {
        const json err{{"error_code", "E_INPUT"}, {"message", "execution_id is null"}};
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    std::lock_guard<std::mutex> lk(core_internal::g_tools_mu);
    const std::string id = execution_id;
    if (!core_internal::g_executions.contains(id)) {
        const json err{
            {"error_code", "E_NOT_FOUND"},
            {"message", "execution not found"},
            {"detail", json{{"execution_id", id}}}
        };
        core_internal::g_last_error = err.dump();
        core_internal::g_last_output = json{{"status", "failed"}, {"error", err}}.dump();
        return core_internal::g_last_output.c_str();
    }

    const core_internal::ExecutionRecord &record = core_internal::g_executions.at(id);
    const std::string tool_use_id = (tool_use_id_override == nullptr) ? "" : std::string(tool_use_id_override);
    core_internal::g_last_output = core_internal::build_claude_tool_result_payload(record, tool_use_id).dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_normalize_runtime_event(const char *raw_event_json) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (raw_event_json == nullptr) {
        core_internal::g_last_error = "raw_event_json is null";
        core_internal::RuntimeEventRecord out = core_internal::base_runtime_record(json::object());
        out.execution_id = core_internal::next_id("invalid");
        out.status = "failed";
        out.error = json{{"code", "invalid_input"}, {"message", core_internal::g_last_error}};
        out.handoff = "manual_takeover";
        core_internal::g_last_output = core_internal::serialize_runtime_event_record(out).dump();
        return core_internal::g_last_output.c_str();
    }

    try {
        const json raw = json::parse(raw_event_json);
        core_internal::RuntimeEventRecord out = core_internal::normalize_runtime_event(raw);
        core_internal::g_last_output = core_internal::serialize_runtime_event_record(out).dump();
        return core_internal::g_last_output.c_str();
    } catch (const std::exception &e) {
        core_internal::g_last_error = e.what();
        core_internal::RuntimeEventRecord out = core_internal::base_runtime_record(json{{"raw_text", raw_event_json}});
        out.execution_id = core_internal::next_id("parse-error");
        out.status = "failed";
        out.error = json{
            {"code", "invalid_json"},
            {"message", core_internal::g_last_error}
        };
        out.handoff = "manual_takeover";
        core_internal::g_last_output = core_internal::serialize_runtime_event_record(out).dump();
        return core_internal::g_last_output.c_str();
    }
}

const char *agent_core_last_error(void) {
    return core_internal::g_last_error.c_str();
}

const char *agent_core_memory_configure(const char *config_json) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    json config;
    json parse_err;
    if (!parse_json_object_arg(config_json, "config_json", &config, &parse_err)) {
        return fail_memory_api(parse_err);
    }

    std::lock_guard<std::mutex> lk(core_internal::g_memory_mu);
    json err;
    const json out = core_internal::configure_memory_locked(config, &err);
    if (!err.is_null()) {
        return fail_memory_api(err);
    }
    core_internal::g_last_output = out.dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_memory_ingest(const char *memory_input_json) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (memory_input_json == nullptr) {
        return fail_memory_api(core_internal::make_error_json(
            "E_INPUT",
            "memory_input_json is null"
        ));
    }

    json input;
    json parse_err;
    if (!parse_json_object_arg(memory_input_json, "memory_input_json", &input, &parse_err)) {
        return fail_memory_api(parse_err);
    }
    if (!enrich_execution_record_input(&input, &parse_err)) {
        return fail_memory_api(parse_err);
    }

    std::lock_guard<std::mutex> lk(core_internal::g_memory_mu);
    json err;
    const json out = core_internal::ingest_memory_locked(input, &err);
    if (!err.is_null()) {
        return fail_memory_api(err);
    }
    core_internal::g_last_output = out.dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_memory_query(const char *query_json) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (query_json == nullptr) {
        return fail_memory_api(core_internal::make_error_json(
            "E_INPUT",
            "query_json is null"
        ));
    }

    json query;
    json parse_err;
    if (!parse_json_object_arg(query_json, "query_json", &query, &parse_err)) {
        return fail_memory_api(parse_err);
    }

    std::lock_guard<std::mutex> lk(core_internal::g_memory_mu);
    json err;
    const json out = core_internal::query_memory_locked(query, &err);
    if (!err.is_null()) {
        return fail_memory_api(err);
    }
    core_internal::g_last_output = out.dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_memory_get(const char *memory_id) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    if (memory_id == nullptr) {
        return fail_memory_api(core_internal::make_error_json(
            "E_INPUT",
            "memory_id is null"
        ));
    }

    std::lock_guard<std::mutex> lk(core_internal::g_memory_mu);
    json err;
    const json out = core_internal::get_memory_locked(memory_id, &err);
    if (!err.is_null()) {
        return fail_memory_api(err);
    }
    core_internal::g_last_output = out.dump();
    return core_internal::g_last_output.c_str();
}

const char *agent_core_memory_reset(void) {
    core_internal::g_last_error.clear();
    core_internal::g_last_output.clear();

    std::lock_guard<std::mutex> lk(core_internal::g_memory_mu);
    json err;
    const json out = core_internal::reset_memory_store_locked(&err);
    if (!err.is_null()) {
        return fail_memory_api(err);
    }
    core_internal::g_last_output = out.dump();
    return core_internal::g_last_output.c_str();
}
