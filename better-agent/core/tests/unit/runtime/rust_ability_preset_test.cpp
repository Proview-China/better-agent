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
          "ability_preset":"all8"
        })"
    ));

    expect(out.at("status") == "success", "preset build should succeed");
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

    expect(has_web_search, "preset should enable web_search");
    expect(names.contains("shell_command"), "preset should enable shell_command");
    expect(names.contains("js_repl"), "preset should enable js_repl");
    expect(names.contains("artifacts"), "preset should enable artifacts");
    expect(names.contains("view_image"), "preset should enable view_image");
    expect(names.contains("list_mcp_resources"), "preset should enable mcp");
    expect(out.at("runtime_capabilities").at("hooks").at("enabled") == true, "preset should enable hooks");
    expect(out.at("runtime_capabilities").at("skills").at("enabled") == true, "preset should enable skills");

    agent_core_shutdown();
    return 0;
}
