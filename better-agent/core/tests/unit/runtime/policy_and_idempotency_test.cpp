#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_execution_record_contract;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *tool = R"({
      "name":"get_weather",
      "description":"weather tool",
      "parameters":{
        "type":"object",
        "properties":{"city":{"type":"string"}},
        "required":["city"],
        "additionalProperties":false
      },
      "mock_result":{"temp_c":21}
    })";
    expect(agent_core_register_tool(tool) == 0, "tool registration should succeed");

    auto first = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"get_weather","arguments":"{\"city\":\"Shanghai\"}"})",
        R"({"allow_tools":["get_weather"],"idempotency_key":"idem-1"})"
    ));
    expect_execution_record_contract(first);
    expect(first.at("status") == "success", "first call should succeed");

    auto replay = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"get_weather","arguments":"{\"city\":\"Shanghai\"}"})",
        R"({"allow_tools":["get_weather"],"idempotency_key":"idem-1"})"
    ));
    expect_execution_record_contract(replay);
    expect(replay.at("status") == "success", "idempotent replay should succeed");
    expect(replay.at("handoff") == "idempotency-hit: reuse previous execution", "expected idempotency replay handoff");

    auto conflict = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"get_weather","arguments":"{\"city\":\"Beijing\"}"})",
        R"({"allow_tools":["get_weather"],"idempotency_key":"idem-1"})"
    ));
    expect(conflict.at("status") == "failed", "idempotency conflict should fail");
    expect(conflict.at("error").at("error_code") == "E_IDEMPOTENCY_CONFLICT", "idempotency conflict error mismatch");

    auto blocked = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"get_weather","arguments":"{\"city\":\"Shanghai\"}"})",
        R"({"deny_tools":["get_weather"]})"
    ));
    expect(blocked.at("status") == "blocked", "deny policy should block");
    expect(blocked.at("error").at("error_code") == "E_POLICY_DENY", "policy error mismatch");

    auto schema_error = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"get_weather","arguments":"{}"})",
        R"({"allow_tools":["get_weather"],"idempotency_key":"idem-2"})"
    ));
    expect(schema_error.at("status") == "failed", "schema validation should fail");
    expect(schema_error.at("error").at("error_code") == "E_SCHEMA", "schema error code mismatch");

    agent_core_shutdown();
    std::cout << "policy_and_idempotency_test: PASS\n";
    return 0;
}
