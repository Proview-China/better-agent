#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto out = parse_json(agent_core_build_gpt_basic_abilities(
        R"({"model":"gpt-5.4"})"
    ));
    expect(out.at("status") == "success", "basic abilities build should succeed");
    expect(out.at("preset") == "gpt_basic_abilities", "preset mismatch");
    expect(out.at("tool_count") >= 8, "basic abilities tool_count should be at least 8");
    expect(out.at("runtime_capabilities").at("hooks").at("enabled") == true, "hooks should be enabled");
    expect(out.at("runtime_capabilities").at("skills").at("enabled") == true, "skills should be enabled");

    agent_core_shutdown();
    return 0;
}
