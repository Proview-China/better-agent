#include <string>
#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *tool = R"({
      "name":"lookup_user",
      "description":"lookup user profile",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "mock_result":{"name":"Alice","tier":"pro"}
    })";
    expect(agent_core_register_tool(tool) == 0, "tool registration should succeed");

    auto openai_exec = parse_json(agent_core_execute_openai_function_call(
        R"({"type":"function_call","name":"lookup_user","call_id":"openai_call_1","arguments":"{\"uid\":\"u-1\"}"})",
        R"({"allow_tools":["lookup_user"]})"
    ));
    expect(openai_exec.at("execution").at("status") == "success", "openai execution should succeed");
    expect(openai_exec.at("provider_payload").at("type") == "function_call_output", "openai payload type mismatch");
    expect(openai_exec.at("provider_payload").at("call_id") == "openai_call_1", "openai call_id mismatch");

    auto claude_exec = parse_json(agent_core_execute_claude_tool_use(
        R"({"type":"tool_use","id":"toolu_1","name":"lookup_user","input":{"uid":"u-1"}})",
        R"({"allow_tools":["lookup_user"]})"
    ));
    expect(claude_exec.at("execution").at("status") == "success", "claude execution should succeed");
    expect(claude_exec.at("provider_payload").at("type") == "tool_result", "claude payload type mismatch");
    expect(claude_exec.at("provider_payload").at("tool_use_id") == "toolu_1", "claude tool_use_id mismatch");

    const auto execution_id = openai_exec.at("execution").at("execution_id").get<std::string>();
    auto openai_payload = parse_json(agent_core_build_openai_function_call_output(execution_id.c_str(), nullptr));
    expect(openai_payload.at("type") == "function_call_output", "builder openai payload type mismatch");
    expect(openai_payload.at("call_id") == "openai_call_1", "builder openai call_id mismatch");

    auto claude_payload = parse_json(agent_core_build_claude_tool_result(execution_id.c_str(), "toolu_override"));
    expect(claude_payload.at("type") == "tool_result", "builder claude payload type mismatch");
    expect(claude_payload.at("tool_use_id") == "toolu_override", "builder claude tool_use_id mismatch");

    agent_core_shutdown();
    std::cout << "provider_payload_builders_test: PASS\n";
    return 0;
}
