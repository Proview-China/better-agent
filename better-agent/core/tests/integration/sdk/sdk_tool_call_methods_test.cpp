#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *tool = R"({
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
    expect(agent_core_register_tool(tool) == 0, "tool registration should succeed");

    auto openai = parse_json(agent_core_execute_openai_function_call(
        R"({"type":"function_call","name":"sum_numbers","call_id":"call_oai_1","arguments":"{\"a\":1,\"b\":2}"})",
        R"({"allow_tools":["sum_numbers"],"openai_model":"gpt-5-codex","parallel_tool_calls":false})"
    ));
    expect(openai.at("execution").at("status") == "success", "openai execution should succeed");
    expect(openai.at("sdk").at("sdk_enabled") == true, "sdk bridge should be enabled");
    expect(openai.at("sdk").at("request").at("tools")[0].at("type") == "function", "openai sdk tool type mismatch");
    expect(openai.at("sdk").at("request").at("tool_choice").at("type") == "function", "openai tool choice mismatch");
    expect(openai.at("sdk").at("request").at("input")[0].at("type") == "function_call", "openai sdk input type mismatch");

    auto claude = parse_json(agent_core_execute_claude_tool_use(
        R"({"type":"tool_use","id":"toolu_1","name":"sum_numbers","input":{"a":1,"b":2}})",
        R"({"allow_tools":["sum_numbers"],"claude_model":"claude-3-7-sonnet-latest"})"
    ));
    expect(claude.at("execution").at("status") == "success", "claude execution should succeed");
    expect(claude.at("sdk").at("sdk_enabled") == true, "sdk bridge should be enabled");
    expect(claude.at("sdk").at("request").at("tools")[0].at("name") == "sum_numbers", "claude sdk tool name mismatch");
    expect(claude.at("sdk").at("request").at("tool_choice").at("type") == "tool", "claude tool choice mismatch");
    expect(claude.at("sdk").at("request").at("input").at("type") == "tool_use", "claude sdk input type mismatch");

    agent_core_shutdown();
    std::cout << "sdk_tool_call_methods_test: PASS\n";
    return 0;
}
