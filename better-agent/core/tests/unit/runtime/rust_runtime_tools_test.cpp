#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *request_json = R"({
      "model":"gpt-5.4",
      "input_text":"Use the available runtime tools when needed.",
      "js_repl_enabled":true,
      "artifacts_enabled":true,
      "view_image_enabled":true,
      "mcp_resource_tools_enabled":true,
      "text":{"verbosity":"low"}
    })";

    auto built = parse_json(agent_core_build_gpt_responses_request(request_json));
    const auto &tools = built.at("tools");
    expect(tools.is_array(), "tools should be an array");
    expect(tools.size() == 6, "runtime tools count mismatch");

    expect(tools.at(0).at("type") == "custom", "js_repl should be custom");
    expect(tools.at(0).at("name") == "js_repl", "first tool should be js_repl");
    expect(tools.at(1).at("type") == "custom", "artifacts should be custom");
    expect(tools.at(1).at("name") == "artifacts", "second tool should be artifacts");
    expect(tools.at(2).at("type") == "function", "view_image should be function");
    expect(tools.at(2).at("name") == "view_image", "third tool should be view_image");
    expect(tools.at(3).at("name") == "list_mcp_resources", "fourth tool should be list_mcp_resources");
    expect(tools.at(4).at("name") == "list_mcp_resource_templates", "fifth tool should be list_mcp_resource_templates");
    expect(tools.at(5).at("name") == "read_mcp_resource", "sixth tool should be read_mcp_resource");

    agent_core_shutdown();
    return 0;
}
