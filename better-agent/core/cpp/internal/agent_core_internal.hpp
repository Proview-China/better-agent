#ifndef BETTER_AGENT_CORE_INTERNAL_HPP
#define BETTER_AGENT_CORE_INTERNAL_HPP

#include <atomic>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "nlohmann/json.hpp"

namespace better_agent::core_internal {

using json = nlohmann::json;

struct ToolSpec {
    std::string name;
    std::string description;
    json parameters;
    json constraints;
};

enum class ExecutorKind {
    Mock,
    Builtin,
    Native,
};

struct ToolRegistration {
    ToolSpec spec;
    std::string tool_kind = "function";
    ExecutorKind executor_kind = ExecutorKind::Mock;
    std::string executor_target;
    json mock_result;
};

struct NormalizedCall {
    std::string provider_kind = "custom";
    std::string tool_name;
    std::string intent;
    std::string provider_call_id;
    json input_raw = json::object();
    json input_normalized = json::object();
};

struct PolicyView {
    json raw_json = json::object();
    std::vector<std::string> allow_tools;
    std::vector<std::string> deny_tools;
    std::string idempotency_key;
    std::vector<std::string> before_tool_hooks;
    std::vector<std::string> after_tool_hooks;
    bool enable_hook_recursion = false;
};

struct ToolExecutionRequest {
    std::string tool_name;
    std::string tool_kind = "function";
    std::string provider_kind;
    std::string intent;
    std::string provider_call_id;
    json args = json::object();
    json policy = json::object();
};

struct ToolExecutionResult {
    std::string status = "success";
    json result = json::object();
    json error = nullptr;
    json evidence = json::array();
    std::string handoff = "continue";
};

struct ExecutionRecord {
    std::string execution_id;
    std::string tool_kind = "function";
    std::string provider_kind = "custom";
    std::string intent;
    std::string provider_call_id;
    json input_raw = json::object();
    json input_normalized = json::object();
    json policy_snapshot = json::object();
    std::string status = "failed";
    json evidence = json::array();
    json error = nullptr;
    std::string handoff;
    std::string timestamp;
    json result = json::object();
};

struct RuntimeEventRecord {
    std::string execution_id;
    std::string source = "unknown";
    std::string event_type = "unknown";
    std::string tool_kind = "function";
    json intent = nullptr;
    json input_raw = json::object();
    json input_normalized = json::object();
    json policy_snapshot = json::object();
    std::string status = "partial";
    json evidence = json::array();
    json error = nullptr;
    std::string handoff = "continue_observing";
    std::string timestamp;
};

extern std::atomic<unsigned long long> g_seq;
extern thread_local std::string g_last_error;
extern thread_local std::string g_last_output;
extern std::mutex g_tools_mu;
extern std::unordered_map<std::string, ToolRegistration> g_tools;
extern std::unordered_map<std::string, ExecutionRecord> g_executions;
extern std::unordered_map<std::string, std::string> g_idempotency_to_execution;
extern std::unordered_map<std::string, std::string> g_idempotency_signature;

std::string now_iso8601_utc();
std::string next_id(const std::string &prefix);

std::string get_string_or(const json &obj, const char *key, const std::string &fallback = "");
json get_json_or(const json &obj, const char *key, const json &fallback = json());
std::vector<std::string> json_string_array_to_vector(const json &value);
PolicyView build_policy_view(const json &policy);

json serialize_normalized_call(const NormalizedCall &call);
json serialize_execution_record(const ExecutionRecord &record);
ExecutionRecord deserialize_execution_record(const json &obj);
json serialize_runtime_event_record(const RuntimeEventRecord &record);

std::string get_status_from_codex_item(const std::string &event_type, const json &item);
std::string codex_tool_kind(const std::string &item_type);
std::string claude_tool_kind(const std::string &tool_name);
std::string default_handoff(const std::string &status);
bool is_supported_tool_kind(const std::string &tool_kind);
std::string infer_tool_kind_from_executor_target(const std::string &executor_target);

bool validate_type(const json &value, const std::string &expected);
json schema_validate_args(const json &args, const json &schema);
json parse_policy_json(const char *policy_json, json *err_out);
bool fail_function_call(const json &err, const std::string &status = "failed", const std::string &tool_name = "");
bool parse_model_output_json(const char *model_output_json, json *raw_out);
json parse_optional_object_json(const char *json_text);

bool parse_tool_registration_json(const char *tool_definition_json, ToolRegistration *tool_out);
bool normalize_function_call_payload(const json &raw, NormalizedCall *call_out, json *err_out);
bool prepare_function_call_request(
    const char *model_output_json,
    const char *policy_json,
    PolicyView *policy_out,
    NormalizedCall *normalized_out
);

const ToolRegistration *find_registered_tool(const std::string &tool_name);
const ToolRegistration *lookup_registered_tool(const std::string &tool_name);
bool validate_tool_call_request(
    const ToolRegistration &tool,
    const NormalizedCall &call,
    const PolicyView &policy
);
void load_registered_tool_metadata(
    const std::string &tool_name,
    std::string *tool_description_out,
    json *tool_parameters_out,
    json *tool_constraints_out
);

json resolve_mock_result(const ToolRegistration &tool, const json &args);
ToolExecutionResult execute_mock_tool(const ToolRegistration &tool, const ToolExecutionRequest &request);
std::string resolve_executor_target(const ToolRegistration &tool);
ToolExecutionResult execute_builtin_tool(const ToolRegistration &tool, const ToolExecutionRequest &request);
ToolExecutionResult execute_native_tool(const ToolRegistration &tool, const ToolExecutionRequest &request);
ToolExecutionResult execute_tool_registration(const ToolRegistration &tool, const ToolExecutionRequest &request);
std::string build_idempotency_signature(const NormalizedCall &call);
bool handle_idempotency_replay_locked(
    const PolicyView &policy,
    const NormalizedCall &call,
    std::string *idempotency_key_out,
    std::string *idempotency_signature_out
);
ToolExecutionRequest build_tool_execution_request(
    const ToolRegistration &tool,
    const NormalizedCall &call,
    const PolicyView &policy
);
ExecutionRecord build_execution_record(
    const ToolRegistration &tool,
    const NormalizedCall &call,
    const PolicyView &policy,
    const ToolExecutionResult &execution
);
void store_execution_record_locked(
    const ExecutionRecord &record,
    const std::string &idempotency_key,
    const std::string &idempotency_signature
);
bool execute_prepared_function_call_locked(const PolicyView &policy, const NormalizedCall &call);

json build_provider_execution_wrapper(
    const json &record,
    const json &provider_payload,
    const json &sdk_bundle
);
std::string extract_provider_call_id(const json &record);
std::string extract_provider_call_id(const ExecutionRecord &record);
std::string extract_tool_name_from_record(const json &record);
std::string extract_tool_name_from_record(const ExecutionRecord &record);
json build_openai_function_call_output_payload(const json &record, const std::string &call_id_override);
json build_openai_function_call_output_payload(const ExecutionRecord &record, const std::string &call_id_override);
json build_claude_tool_result_payload(const json &record, const std::string &tool_use_id_override);
json build_claude_tool_result_payload(const ExecutionRecord &record, const std::string &tool_use_id_override);

RuntimeEventRecord base_runtime_record(const json &raw);
RuntimeEventRecord normalize_codex(const json &raw);
RuntimeEventRecord normalize_claude(const json &raw);
RuntimeEventRecord normalize_unknown(const json &raw);
RuntimeEventRecord normalize_runtime_event(const json &raw);

} // namespace better_agent::core_internal

#endif // BETTER_AGENT_CORE_INTERNAL_HPP
