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
    expect(openai.at("provider_payload").at("type") == "function_call_output", "provider payload type mismatch");
    expect(openai.at("provider_payload").at("call_id") == "call_oai_1", "provider payload call_id mismatch");
    expect(openai.at("provider_payload").at("output").at("sum") == 3, "provider payload output mismatch");

    agent_core_shutdown();
    return 0;
}
