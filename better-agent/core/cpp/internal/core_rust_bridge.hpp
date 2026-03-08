#ifndef BETTER_AGENT_CORE_RUST_BRIDGE_HPP
#define BETTER_AGENT_CORE_RUST_BRIDGE_HPP

#include <string>

#include "nlohmann/json.hpp"

namespace better_agent::core_internal {

using json = nlohmann::json;

std::string rust_runtime_version();
json build_gpt_responses_request_via_rust(const json &request_json, json *err_out);
json build_gpt_toolset_via_rust(const json &request_json, json *err_out);
json build_gpt_basic_abilities_via_rust(const json &request_json, json *err_out);
json build_after_tool_use_hook_payload_via_rust(const json &request_json, json *err_out);
json render_skills_section_via_rust(const json &request_json, json *err_out);
json build_openai_function_call_output_payload_via_rust(const json &request_json, json *err_out);
json build_openai_bridge_outputs_via_rust(const json &request_json, json *err_out);
json build_claude_tool_result_payload_via_rust(const json &request_json, json *err_out);
json build_provider_execution_wrapper_via_rust(const json &request_json, json *err_out);
json build_openai_request_from_execution_via_rust(const json &request_json, json *err_out);

} // namespace better_agent::core_internal

#endif // BETTER_AGENT_CORE_RUST_BRIDGE_HPP
