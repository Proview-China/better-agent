#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_runtime_record_contract;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto null_input = parse_json(agent_core_normalize_runtime_event(nullptr));
    expect_runtime_record_contract(null_input);
    expect(null_input.at("status") == "failed", "null runtime event should fail");

    auto codex_item = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"item.completed","item":{"id":"item-1","type":"command_execution","status":"completed","command":"echo hi","aggregated_output":"hi","exit_code":0}})"
    ));
    expect_runtime_record_contract(codex_item);
    expect(codex_item.at("source") == "codex_cli", "codex runtime source mismatch");
    expect(codex_item.at("status") == "success", "codex runtime status mismatch");

    auto invalid_json = parse_json(agent_core_normalize_runtime_event("{"));
    expect_runtime_record_contract(invalid_json);
    expect(invalid_json.at("status") == "failed", "invalid json should fail");

    agent_core_shutdown();
    std::cout << "runtime_normalization_contract_test: PASS\n";
    return 0;
}
