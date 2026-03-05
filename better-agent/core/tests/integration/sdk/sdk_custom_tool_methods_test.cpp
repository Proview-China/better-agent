#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *custom_tool = R"({
      "name":"search_kb",
      "description":"search custom knowledge base",
      "parameters":{
        "type":"object",
        "properties":{"query":{"type":"string"}},
        "required":["query"],
        "additionalProperties":false
      },
      "constraints":{"tool_type":"custom"},
      "mock_result":{"hits":[{"title":"KB-1"}]}
    })";
    expect(agent_core_register_tool(custom_tool) == 0, "custom tool registration should succeed");

    auto openai_custom = parse_json(agent_core_execute_openai_function_call(
        R"({"type":"function_call","name":"search_kb","call_id":"call_custom_1","arguments":"{\"query\":\"hello\"}"})",
        R"({"allow_tools":["search_kb"],"tool_type":"custom","openai_model":"gpt-5-codex"})"
    ));
    expect(openai_custom.at("execution").at("status") == "success", "openai custom call should succeed");
    expect(openai_custom.at("sdk").at("request").at("tools")[0].at("type") == "custom", "openai custom tool type mismatch");
    expect(openai_custom.at("sdk").at("request").at("tool_choice").at("type") == "custom", "openai custom tool choice mismatch");
    expect(openai_custom.at("sdk").at("request").at("input")[0].at("type") == "custom_tool_call", "openai custom input type mismatch");

    auto generic_custom = parse_json(agent_core_execute_function_call(
        R"({"tool":"search_kb","arguments":{"query":"hello"},"call_id":"generic_custom_1"})",
        R"({"allow_tools":["search_kb"],"tool_type":"custom"})"
    ));
    expect(generic_custom.at("status") == "success", "generic custom tool should succeed");
    expect(generic_custom.at("result").at("hits")[0].at("title") == "KB-1", "custom mock result mismatch");

    auto claude_custom = parse_json(agent_core_execute_claude_tool_use(
        R"({"type":"tool_use","id":"toolu_custom_1","name":"search_kb","input":{"query":"hello"}})",
        R"({"allow_tools":["search_kb"],"claude_model":"claude-3-7-sonnet-latest"})"
    ));
    expect(claude_custom.at("execution").at("status") == "success", "claude custom call should succeed");
    expect(claude_custom.at("sdk").at("request").at("tools")[0].at("name") == "search_kb", "claude custom tool name mismatch");

    agent_core_shutdown();
    std::cout << "sdk_custom_tool_methods_test: PASS\n";
    return 0;
}
