#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_execution_record_contract;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *mock_tool = R"({
      "name":"lookup_profile",
      "description":"mock-backed lookup",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "mock_result":{"name":"Alice","tier":"pro"}
    })";
    expect(agent_core_register_tool(mock_tool) == 0, "mock tool registration should succeed");

    const char *fallback_tool = R"({
      "name":"echo_profile",
      "description":"fallback echo tool",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      }
    })";
    expect(agent_core_register_tool(fallback_tool) == 0, "fallback tool registration should succeed");

    auto mock_record = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"lookup_profile","arguments":"{\"uid\":\"u-1\"}"})",
        R"({"allow_tools":["lookup_profile"]})"
    ));
    expect_execution_record_contract(mock_record);
    expect(mock_record.at("status") == "success", "mock executor should succeed");
    expect(mock_record.at("result").at("name") == "Alice", "mock executor result mismatch");

    auto fallback_record = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"echo_profile","arguments":"{\"uid\":\"u-2\"}"})",
        R"({"allow_tools":["echo_profile"]})"
    ));
    expect_execution_record_contract(fallback_record);
    expect(fallback_record.at("status") == "success", "fallback executor should succeed");
    expect(fallback_record.at("result").at("ok") == true, "fallback executor should emit ok=true");
    expect(fallback_record.at("result").at("echo").at("uid") == "u-2", "fallback executor should echo args");

    auto blocked = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"lookup_profile","arguments":"{\"uid\":\"u-1\"}"})",
        R"({"deny_tools":["lookup_profile"]})"
    ));
    expect(blocked.at("status") == "blocked", "blocked tool should not execute");
    expect(blocked.at("error").at("error_code") == "E_POLICY_DENY", "blocked tool error mismatch");

    auto openai_wrapper = parse_json(agent_core_execute_openai_function_call(
        R"({"type":"function_call","name":"lookup_profile","call_id":"exec_wrap_1","arguments":"{\"uid\":\"u-3\"}"})",
        R"({"allow_tools":["lookup_profile"]})"
    ));
    expect(openai_wrapper.at("execution").at("result").at("tier") == "pro", "openai wrapper execution result mismatch");
    expect(openai_wrapper.at("provider_payload").at("type") == "function_call_output", "openai wrapper payload type mismatch");

    agent_core_shutdown();
    std::cout << "tool_executor_regressions_test: PASS\n";
    return 0;
}
