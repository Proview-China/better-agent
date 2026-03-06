#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_execution_record_contract;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    expect(agent_core_register_tool(R"({"description":"missing name"})") == 2, "missing name should fail with rc=2");
    auto missing_name_error = parse_json(agent_core_last_error());
    expect(missing_name_error.at("error_code") == "E_TOOL_DEF", "missing name error code mismatch");

    expect(agent_core_register_tool("{") == 3, "invalid tool definition json should fail with rc=3");
    auto parse_error = parse_json(agent_core_last_error());
    expect(parse_error.at("error_code") == "E_PARSE", "tool definition parse error mismatch");

    expect(agent_core_register_tool(R"({"name":"bad_executor","constraints":{"executor_kind":"invalid"}})") == 2,
        "invalid executor kind should fail with rc=2");
    auto executor_kind_error = parse_json(agent_core_last_error());
    expect(executor_kind_error.at("error_code") == "E_TOOL_DEF", "invalid executor kind error mismatch");

    const char *initial_tool = R"({
      "name":"lookup_user",
      "description":"first version",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "mock_result":{"name":"Alice"}
    })";
    expect(agent_core_register_tool(initial_tool) == 0, "initial tool registration should succeed");

    const char *override_tool = R"({
      "name":"lookup_user",
      "description":"override version",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "mock_result":{"name":"Bob"}
    })";
    expect(agent_core_register_tool(override_tool) == 0, "override tool registration should succeed");

    auto overridden = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"lookup_user","arguments":"{\"uid\":\"u-1\"}"})",
        R"({"allow_tools":["lookup_user"]})"
    ));
    expect_execution_record_contract(overridden);
    expect(overridden.at("result").at("name") == "Bob", "later tool registration should override mock_result");

    const char *echo_tool = R"({
      "name":"echo_lookup",
      "description":"no mock result tool",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "constraints":{"tool_type":"custom"}
    })";
    expect(agent_core_register_tool(echo_tool) == 0, "echo tool registration should succeed");

    auto echoed = parse_json(agent_core_execute_function_call(
        R"({"tool":"echo_lookup","arguments":{"uid":"u-9"}})",
        R"({"allow_tools":["echo_lookup"],"tool_type":"custom"})"
    ));
    expect_execution_record_contract(echoed);
    expect(echoed.at("result").at("ok") == true, "fallback result should mark ok=true");
    expect(echoed.at("result").at("echo").at("uid") == "u-9", "fallback result should echo arguments");

    agent_core_shutdown();
    std::cout << "tool_registration_regressions_test: PASS\n";
    return 0;
}
