#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_runtime_record_contract;
    using better_agent::tests::parse_json;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto codex_turn_started = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"turn.started"})"
    ));
    expect_runtime_record_contract(codex_turn_started);
    expect(codex_turn_started.at("source") == "codex_cli", "codex turn.started source mismatch");
    expect(codex_turn_started.at("status") == "running", "codex turn.started status mismatch");
    expect(codex_turn_started.at("intent") == "turn_start", "codex turn.started intent mismatch");

    auto codex_turn_completed = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"turn.completed","usage":{"input_tokens":11,"output_tokens":7}})"
    ));
    expect_runtime_record_contract(codex_turn_completed);
    expect(codex_turn_completed.at("event_type") == "turn.completed", "codex turn.completed event_type mismatch");
    expect(codex_turn_completed.at("status") == "success", "codex turn.completed status mismatch");
    expect(codex_turn_completed.at("evidence").size() >= 1, "codex turn.completed evidence should contain usage");

    auto claude_result = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"result","session_id":"sess-2","subtype":"success","stop_reason":"end_turn","num_turns":2,"usage":{"input_tokens":20,"output_tokens":10},"duration_ms":100,"duration_api_ms":80,"total_cost_usd":0.12})"
    ));
    expect_runtime_record_contract(claude_result);
    expect(claude_result.at("source") == "claude_code", "claude result source mismatch");
    expect(claude_result.at("event_type") == "result.success", "claude result event_type mismatch");
    expect(claude_result.at("status") == "success", "claude result status mismatch");
    expect(claude_result.at("intent") == "turn_result", "claude result intent mismatch");
    expect(claude_result.at("input_normalized").at("num_turns") == 2, "claude result num_turns mismatch");

    auto unknown_event = parse_json(agent_core_normalize_runtime_event(
        R"({"type":"mystery.event","payload":{"x":1}})"
    ));
    expect_runtime_record_contract(unknown_event);
    expect(unknown_event.at("source") == "unknown", "unknown event source mismatch");
    expect(unknown_event.at("status") == "partial", "unknown event status mismatch");
    expect(unknown_event.at("intent") == "unknown_event", "unknown event intent mismatch");
    expect(unknown_event.at("handoff") == "manual_classification", "unknown event handoff mismatch");

    agent_core_shutdown();
    std::cout << "runtime_normalization_scenarios_test: PASS\n";
    return 0;
}
