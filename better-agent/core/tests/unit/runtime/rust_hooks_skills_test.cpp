#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto hook = parse_json(agent_core_build_after_tool_use_hook_payload(
        R"({
          "turn_id":"turn-1",
          "call_id":"call-1",
          "tool_name":"shell_command",
          "tool_kind":"local_shell",
          "tool_input":{"input_type":"local_shell","params":{"command":["bash","-lc","printf hi"],"workdir":"/tmp","timeout_ms":1000}},
          "executed":true,
          "success":true,
          "duration_ms":12,
          "mutating":false,
          "sandbox":"workspace-write",
          "sandbox_policy":"workspace-write",
          "output_preview":"hi"
        })"
    ));
    expect(hook.at("event_type") == "after_tool_use", "hook event type mismatch");
    expect(hook.at("tool_kind") == "local_shell", "hook tool_kind mismatch");
    expect(hook.at("tool_input").at("input_type") == "local_shell", "hook input type mismatch");

    auto skills = parse_json(agent_core_render_skills_section(
        R"([
          {"name":"playwright","description":"browser automation","path":"/tmp/playwright/SKILL.md"},
          {"name":"figma","description":"design context","path":"/tmp/figma/SKILL.md"}
        ])"
    ));
    expect(skills.at("status") == "success", "skills render should succeed");
    const auto rendered = skills.at("rendered").get<std::string>();
    expect(rendered.find("## Skills") != std::string::npos, "skills heading missing");
    expect(rendered.find("playwright") != std::string::npos, "playwright entry missing");
    expect(rendered.find("figma") != std::string::npos, "figma entry missing");

    agent_core_shutdown();
    return 0;
}
