#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto version = parse_json(agent_core_rust_runtime_version());
    expect(version.at("status") == "success", "rust runtime version should succeed");
    expect(version.at("runtime") == "rust", "runtime field mismatch");
    expect(version.at("version").is_string(), "rust runtime version should be a string");

    const char *request_json = R"({
      "model":"gpt-5.4",
      "instructions":"You are Codex. Be concise and use tools when appropriate.",
      "input_text":"Call the ping tool and use shell plus web search when needed.",
      "function_tools":[
        {
          "name":"ping",
          "description":"ping test tool",
          "strict":true,
          "parameters":{
            "type":"object",
            "properties":{"message":{"type":"string"}},
            "required":["message"],
            "additionalProperties":false
          }
        }
      ],
      "shell_tool":"local_shell",
      "web_search":{"external_web_access":true},
      "tool_choice":"auto",
      "parallel_tool_calls":true,
      "text":{"verbosity":"low"}
    })";

    auto built = parse_json(agent_core_build_gpt_responses_request(request_json));
    expect(built.at("model") == "gpt-5.4", "model mismatch");
    expect(built.at("tool_choice") == "auto", "tool_choice mismatch");
    expect(built.at("parallel_tool_calls") == true, "parallel_tool_calls mismatch");
    expect(built.at("text").at("verbosity") == "low", "verbosity mismatch");

    const auto &tools = built.at("tools");
    expect(tools.is_array(), "tools should be an array");
    expect(tools.size() == 3, "tools should include function, shell, and web search");
    expect(tools.at(0).at("type") == "function", "first tool should be function");
    expect(tools.at(0).at("name") == "ping", "function tool name mismatch");
    expect(tools.at(1).at("type") == "local_shell", "second tool should be local_shell");
    expect(tools.at(2).at("type") == "web_search", "third tool should be web_search");
    expect(tools.at(2).at("external_web_access") == true, "web search access mismatch");

    const auto &input = built.at("input");
    expect(input.is_array() && input.size() == 1, "input should contain one user item");
    expect(input.at(0).at("role") == "user", "input role mismatch");
    expect(
        input.at(0).at("content").at(0).at("type") == "input_text",
        "input content type mismatch"
    );

    agent_core_shutdown();
    return 0;
}
