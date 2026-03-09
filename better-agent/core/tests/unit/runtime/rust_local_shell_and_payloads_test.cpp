#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto built = parse_json(agent_core_build_gpt_toolset(
        R"({
          "model":"gpt-5.4",
          "shell_tool":"local_shell",
          "function_tools":[
            {
              "name":"ping",
              "description":"ping tool",
              "strict":true,
              "parameters":{
                "type":"object",
                "properties":{"message":{"type":"string"}},
                "required":["message"],
                "additionalProperties":false
              }
            }
          ]
        })"
    ));

    bool has_local_shell = false;
    for (const auto &tool : built.at("tools")) {
        if (tool.contains("type") && tool.at("type") == "local_shell") {
            has_local_shell = true;
        }
    }
    expect(has_local_shell, "toolset should include local_shell");

    auto normalized_local_shell = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"local_shell_call","call_id":"shell-call-1","status":"completed","action":{"type":"exec","command":["bash","-lc","printf hi"],"timeout_ms":1000,"working_directory":"/tmp"}})"
    ));
    expect(normalized_local_shell.at("source") == "openai_responses", "local_shell source mismatch");
    expect(normalized_local_shell.at("tool_kind") == "shell", "local_shell tool_kind mismatch");
    expect(normalized_local_shell.at("status") == "success", "local_shell status mismatch");
    expect(normalized_local_shell.at("input_normalized").at("command").size() == 3, "local_shell command mismatch");

    auto normalized_custom = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"custom_tool_call","call_id":"custom-1","name":"apply_patch","input":"*** Begin Patch\n*** End Patch"})"
    ));
    expect(normalized_custom.at("source") == "openai_responses", "custom tool source mismatch");
    expect(normalized_custom.at("tool_kind") == "custom", "custom tool kind mismatch");

    agent_core_shutdown();
    return 0;
}
