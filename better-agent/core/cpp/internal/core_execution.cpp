#include "agent_core_internal.hpp"

namespace better_agent::core_internal {

json resolve_mock_result(const ToolRegistration &tool, const json &args) {
    if (tool.mock_result.is_object() && !tool.mock_result.empty()) {
        return tool.mock_result;
    }
    return json{{"ok", true}, {"echo", args}};
}

ToolExecutionResult execute_mock_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    return ToolExecutionResult{
        .status = "success",
        .result = resolve_mock_result(tool, request.args),
        .error = nullptr,
        .evidence = json::array(),
        .handoff = "continue"
    };
}

std::string resolve_executor_target(const ToolRegistration &tool) {
    if (!tool.executor_target.empty()) {
        return tool.executor_target;
    }
    return tool.spec.name;
}

using BuiltinExecutorFn = ToolExecutionResult (*)(const ToolRegistration &, const ToolExecutionRequest &);

namespace {

ToolExecutionResult execute_builtin_echo(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    return ToolExecutionResult{
        .status = "success",
        .result = json{{"ok", true}, {"echo", request.args}},
        .error = nullptr,
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "continue"
    };
}

const std::unordered_map<std::string, BuiltinExecutorFn> &builtin_executor_registry() {
    static const std::unordered_map<std::string, BuiltinExecutorFn> kRegistry = {
        {"builtin.echo", &execute_builtin_echo},
    };
    return kRegistry;
}

} // namespace

ToolExecutionResult execute_builtin_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    const auto &registry = builtin_executor_registry();
    if (registry.contains(executor_target)) {
        return registry.at(executor_target)(tool, request);
    }

    return ToolExecutionResult{
        .status = "failed",
        .result = json::object(),
        .error = json{
            {"error_code", "E_EXECUTOR_NOT_FOUND"},
            {"message", "builtin executor is not registered"},
            {"detail", json{{"executor_target", executor_target}}}
        },
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "manual_takeover"
    };
}

ToolExecutionResult execute_native_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    (void)request;
    const std::string executor_target = resolve_executor_target(tool);
    return ToolExecutionResult{
        .status = "blocked",
        .result = json::object(),
        .error = json{
            {"error_code", "E_NATIVE_EXECUTOR_UNAVAILABLE"},
            {"message", "native executor is not available in this build"},
            {"detail", json{{"executor_target", executor_target}}}
        },
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "native"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "manual_takeover"
    };
}

ToolExecutionResult execute_tool_registration(
    const ToolRegistration &tool,
    const ToolExecutionRequest &request
) {
    switch (tool.executor_kind) {
        case ExecutorKind::Builtin:
            return execute_builtin_tool(tool, request);
        case ExecutorKind::Native:
            return execute_native_tool(tool, request);
        case ExecutorKind::Mock:
        default:
            return execute_mock_tool(tool, request);
    }
}

std::string build_idempotency_signature(const NormalizedCall &call) {
    return call.provider_kind + "|" + call.tool_name + "|" + call.input_normalized.dump();
}

bool handle_idempotency_replay_locked(
    const PolicyView &policy,
    const NormalizedCall &call,
    std::string *idempotency_key_out,
    std::string *idempotency_signature_out
) {
    *idempotency_key_out = policy.idempotency_key;
    *idempotency_signature_out = build_idempotency_signature(call);

    if (idempotency_key_out->empty() || !g_idempotency_to_execution.contains(*idempotency_key_out)) {
        return false;
    }

    if (g_idempotency_signature.contains(*idempotency_key_out) &&
        g_idempotency_signature.at(*idempotency_key_out) != *idempotency_signature_out) {
        fail_function_call(json{
            {"error_code", "E_IDEMPOTENCY_CONFLICT"},
            {"message", "idempotency_key reused with different provider/tool/arguments"},
            {"detail", json{{"idempotency_key", *idempotency_key_out}}}
        });
        return true;
    }

    const std::string exec_id = g_idempotency_to_execution.at(*idempotency_key_out);
    if (g_executions.contains(exec_id)) {
        json replay = serialize_execution_record(g_executions.at(exec_id));
        replay["handoff"] = "idempotency-hit: reuse previous execution";
        g_last_output = replay.dump();
        return true;
    }

    return false;
}

ToolExecutionRequest build_tool_execution_request(
    const NormalizedCall &call,
    const PolicyView &policy
) {
    return ToolExecutionRequest{
        .tool_name = call.tool_name,
        .provider_kind = call.provider_kind,
        .intent = call.intent,
        .provider_call_id = call.provider_call_id,
        .args = call.input_normalized,
        .policy = policy.raw_json
    };
}

ExecutionRecord build_execution_record(
    const NormalizedCall &call,
    const PolicyView &policy,
    const ToolExecutionResult &execution
) {
    json evidence = json::array({
        json{{"kind", "runtime_event"}, {"value", "tool_executed"}},
        json{{"kind", "provider_kind"}, {"value", call.provider_kind}},
        json{{"kind", "provider_call_id"}, {"value", call.provider_call_id}},
        json{{"kind", "timestamp"}, {"value", now_iso8601_utc()}}
    });
    if (execution.evidence.is_array()) {
        for (const auto &item : execution.evidence) {
            evidence.push_back(item);
        }
    }

    return ExecutionRecord{
        .execution_id = next_id("exec"),
        .tool_kind = "function",
        .provider_kind = call.provider_kind,
        .intent = call.intent,
        .provider_call_id = call.provider_call_id,
        .input_raw = call.input_raw,
        .input_normalized = call.input_normalized,
        .policy_snapshot = policy.raw_json,
        .status = execution.status,
        .evidence = evidence,
        .error = execution.error,
        .handoff = execution.handoff,
        .timestamp = now_iso8601_utc(),
        .result = execution.result
    };
}

void store_execution_record_locked(
    const ExecutionRecord &record,
    const std::string &idempotency_key,
    const std::string &idempotency_signature
) {
    const std::string execution_id = record.execution_id;
    g_executions[execution_id] = record;
    if (!idempotency_key.empty()) {
        g_idempotency_to_execution[idempotency_key] = execution_id;
        g_idempotency_signature[idempotency_key] = idempotency_signature;
    }
    g_last_output = serialize_execution_record(record).dump();
}

bool execute_prepared_function_call_locked(const PolicyView &policy, const NormalizedCall &call) {
    std::string idem;
    std::string idem_signature;
    if (handle_idempotency_replay_locked(policy, call, &idem, &idem_signature)) {
        return true;
    }

    const ToolRegistration *tool = lookup_registered_tool(call.tool_name);
    if (tool == nullptr) {
        return true;
    }

    if (!validate_tool_call_request(*tool, call, policy)) {
        return true;
    }

    const ToolExecutionRequest request = build_tool_execution_request(call, policy);
    const ToolExecutionResult execution = execute_tool_registration(*tool, request);
    ExecutionRecord record = build_execution_record(call, policy, execution);
    store_execution_record_locked(record, idem, idem_signature);
    return true;
}

} // namespace better_agent::core_internal
