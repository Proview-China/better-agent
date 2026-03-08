#ifndef BETTER_AGENT_TOOL_CALL_SDK_BRIDGE_HPP
#define BETTER_AGENT_TOOL_CALL_SDK_BRIDGE_HPP

#include <string>
#include "nlohmann/json.hpp"

namespace better_agent {
namespace sdk_bridge {

nlohmann::json build_openai_bundle(
    const std::string &tool_name,
    const std::string &tool_description,
    const nlohmann::json &tool_parameters,
    const nlohmann::json &tool_constraints,
    const nlohmann::json &args,
    const nlohmann::json &policy,
    const std::string &provider_call_id
);
nlohmann::json build_openai_bundle_from_request(
    const nlohmann::json &request_json,
    const nlohmann::json &policy
);

nlohmann::json build_claude_bundle(
    const std::string &tool_name,
    const std::string &tool_description,
    const nlohmann::json &tool_parameters,
    const nlohmann::json &tool_constraints,
    const nlohmann::json &args,
    const nlohmann::json &policy,
    const std::string &provider_call_id
);

} // namespace sdk_bridge
} // namespace better_agent

#endif // BETTER_AGENT_TOOL_CALL_SDK_BRIDGE_HPP
