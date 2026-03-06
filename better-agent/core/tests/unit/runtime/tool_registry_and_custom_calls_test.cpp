#include <string>
#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_execution_record_contract;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *function_tool = R"({
      "name":"sum_numbers",
      "description":"sum two integers",
      "parameters":{
        "type":"object",
        "properties":{"a":{"type":"integer"},"b":{"type":"integer"}},
        "required":["a","b"],
        "additionalProperties":false
      },
      "mock_result":{"sum":3}
    })";
    expect(agent_core_register_tool(function_tool) == 0, "function tool registration should succeed");

    const char *custom_tool = R"({
      "name":"custom_lookup",
      "description":"custom lookup tool",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "constraints":{"tool_type":"custom"},
      "mock_result":{"name":"Alice","tier":"pro"}
    })";
    expect(agent_core_register_tool(custom_tool) == 0, "custom tool registration should succeed");

    auto function_record = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"sum_numbers","arguments":"{\"a\":1,\"b\":2}","call_id":"fc_1"})",
        R"({"allow_tools":["sum_numbers"]})"
    ));
    expect_execution_record_contract(function_record);
    expect(function_record.at("status") == "success", "function call should succeed");
    expect(function_record.at("result").at("sum") == 3, "function call result mismatch");

    auto custom_record = parse_json(agent_core_execute_function_call(
        R"({"tool":"custom_lookup","arguments":{"uid":"u-1"},"call_id":"custom_1"})",
        R"({"allow_tools":["custom_lookup"],"tool_type":"custom"})"
    ));
    expect_execution_record_contract(custom_record);
    expect(custom_record.at("status") == "success", "custom tool call should succeed");
    expect(custom_record.at("result").at("name") == "Alice", "custom tool result mismatch");

    const auto execution_id = function_record.at("execution_id").get<std::string>();
    auto loaded = parse_json(agent_core_get_execution(execution_id.c_str()));
    expect_execution_record_contract(loaded);
    expect(loaded.at("execution_id") == execution_id, "stored execution lookup should succeed");

    agent_core_shutdown();
    std::cout << "tool_registry_and_custom_calls_test: PASS\n";
    return 0;
}
