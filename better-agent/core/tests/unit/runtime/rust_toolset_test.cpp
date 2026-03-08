#include <set>
#include <string>

#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto out = parse_json(agent_core_build_gpt_toolset(
        R"({
          "model":"gpt-5.4",
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
          "shell_tool":"shell_command",
          "web_search":{"external_web_access":true},
          "js_repl_enabled":true,
          "artifacts_enabled":true,
          "view_image_enabled":true,
          "mcp_resource_tools_enabled":true,
          "hooks_enabled":true,
          "skills_enabled":true,
          "skill_roots":["/tmp/skills","/opt/skills"]
        })"
    ));

    expect(out.at("status") == "success", "toolset build should succeed");
    expect(out.at("runtime") == "rust", "runtime mismatch");
    expect(out.at("tool_count") == 9, "tool_count mismatch");
    std::set<std::string> names;
    bool has_web_search = false;
    for (const auto &tool : out.at("tools")) {
        if (tool.contains("name") && tool.at("name").is_string()) {
            names.insert(tool.at("name").get<std::string>());
        }
        if (tool.contains("type") && tool.at("type") == "web_search") {
            has_web_search = true;
        }
    }
    expect(names.contains("ping"), "missing ping");
    expect(names.contains("shell_command"), "missing shell_command");
    expect(has_web_search, "missing web_search");
    expect(names.contains("js_repl"), "missing js_repl");
    expect(names.contains("artifacts"), "missing artifacts");
    expect(names.contains("view_image"), "missing view_image");
    expect(names.contains("list_mcp_resources"), "missing list_mcp_resources");
    expect(names.contains("list_mcp_resource_templates"), "missing list_mcp_resource_templates");
    expect(names.contains("read_mcp_resource"), "missing read_mcp_resource");

    expect(out.at("runtime_capabilities").at("hooks").at("enabled") == true, "hooks should be enabled");
    expect(out.at("runtime_capabilities").at("skills").at("enabled") == true, "skills should be enabled");
    expect(out.at("runtime_capabilities").at("hooks").at("event_types").size() == 2, "hook event types mismatch");
    expect(out.at("runtime_capabilities").at("skills").at("skill_roots").size() == 2, "skill roots mismatch");

    agent_core_shutdown();
    return 0;
}
