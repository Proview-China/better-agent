#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *request_json = R"({
      "model":"gpt-5.3-codex",
      "instructions":"You are Codex. Use the provided tools.",
      "input_items":[
        {
          "role":"user",
          "content":[{"type":"input_text","text":"Use custom apply_patch and exec_command when appropriate."}]
        }
      ],
      "custom_tools":[
        {
          "name":"apply_patch",
          "description":"Apply a textual patch to files.",
          "format":{
            "type":"grammar",
            "syntax":"lark",
            "definition":"start: \"*** Begin Patch\" /[\\\\s\\\\S]*/ \"*** End Patch\""
          }
        }
      ],
      "shell_tool":"exec_command",
      "tool_choice":{"type":"custom","name":"apply_patch"},
      "parallel_tool_calls":false,
      "text":{"verbosity":"low"}
    })";

    auto built = parse_json(agent_core_build_gpt_responses_request(request_json));
    expect(built.at("model") == "gpt-5.3-codex", "model mismatch");
    expect(built.at("parallel_tool_calls") == false, "parallel_tool_calls mismatch");
    expect(built.at("tool_choice").at("type") == "custom", "tool_choice type mismatch");
    expect(built.at("tool_choice").at("name") == "apply_patch", "tool_choice name mismatch");

    const auto &tools = built.at("tools");
    expect(tools.is_array(), "tools should be an array");
    expect(tools.size() == 2, "tools should include custom and exec_command");
    expect(tools.at(0).at("type") == "custom", "first tool should be custom");
    expect(tools.at(0).at("name") == "apply_patch", "custom tool name mismatch");
    expect(tools.at(1).at("type") == "function", "second tool should be function");
    expect(tools.at(1).at("name") == "exec_command", "exec_command tool name mismatch");

    const auto &input = built.at("input");
    expect(input.is_array() && input.size() == 1, "input should contain one item");
    expect(input.at(0).at("content").at(0).at("text") == "Use custom apply_patch and exec_command when appropriate.", "input passthrough mismatch");

    agent_core_shutdown();
    return 0;
}
