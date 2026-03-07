#include <ctime>
#include <filesystem>
#include <iostream>
#include <string>

#include "agent_core.h"
#include "test_helpers.hpp"

namespace {

std::string make_store_path(const char *suffix) {
    namespace fs = std::filesystem;
    return (fs::temp_directory_path() /
        (std::string("agent-core-memory-") + suffix + "-" + std::to_string(std::time(nullptr)) + ".json")).string();
}

bool evidence_has_kind_value(const nlohmann::json &evidence, const std::string &kind, const std::string &value) {
    if (!evidence.is_array()) {
        return false;
    }
    for (const auto &entry : evidence) {
        if (entry.is_object() && entry.value("kind", "") == kind && entry.value("value", "") == value) {
            return true;
        }
    }
    return false;
}

} // namespace

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_execution_record_contract;
    using better_agent::tests::expect_memory_entry_contract;
    using better_agent::tests::expect_memory_query_contract;
    using better_agent::tests::parse_json;

    namespace fs = std::filesystem;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const std::string store_path = make_store_path("execution-guard");
    const std::string configure_json =
        std::string(R"({"store_path":")") + store_path + R"(","max_injection_entries":1,"max_injection_chars":600})";
    auto configured = parse_json(agent_core_memory_configure(configure_json.c_str()));
    expect(configured.at("status") == "success", "memory configure should succeed");
    auto reset_before = parse_json(agent_core_memory_reset());
    expect(reset_before.at("status") == "success", "memory reset should succeed");

    const char *tool = R"({
      "name":"lookup_profile",
      "description":"lookup profile",
      "parameters":{
        "type":"object",
        "properties":{"uid":{"type":"string"}},
        "required":["uid"],
        "additionalProperties":false
      },
      "mock_result":{"name":"Alice","tier":"pro"}
    })";
    expect(agent_core_register_tool(tool) == 0, "tool registration should succeed");

    auto execution = parse_json(agent_core_execute_function_call(
        R"({"type":"function_call","name":"lookup_profile","arguments":"{\"uid\":\"u-42\"}"})",
        R"({"allow_tools":["lookup_profile"]})"
    ));
    expect_execution_record_contract(execution);
    const std::string execution_id = execution.at("execution_id").get<std::string>();

    const std::string execution_ingest_json =
        std::string(R"({"input_type":"execution_record","execution_id":")") + execution_id + R"(","layer":"task","scope":{"task":"beta"}})";
    auto execution_memory = parse_json(agent_core_memory_ingest(execution_ingest_json.c_str()));
    expect(execution_memory.at("status") == "success", "execution ingest should succeed");
    expect_memory_entry_contract(execution_memory.at("memory"));
    expect(evidence_has_kind_value(execution_memory.at("memory").at("evidence"), "execution_id", execution_id), "execution memory should keep execution_id evidence");

    auto expired_memory = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"stale-topic",
          "summary":"这是一条已过期记忆",
          "layer":"task",
          "scope":{"task":"beta"},
          "ttl_seconds":0,
          "evidence":[{"kind":"note","value":"stale"}]
        })"
    ));
    expect(expired_memory.at("status") == "success", "expired memory ingest should succeed");
    const std::string expired_id = expired_memory.at("memory").at("memory_id").get<std::string>();

    auto default_query = parse_json(agent_core_memory_query(R"({"topic":"stale-topic"})"));
    expect_memory_query_contract(default_query);
    expect(default_query.at("total_matches") == 0, "default query should filter expired memory");

    auto expired_query = parse_json(agent_core_memory_query(R"({"topic":"stale-topic","include_expired":true})"));
    expect(expired_query.at("total_matches") == 1, "expired query should include expired memory");
    expect(expired_query.at("results").at(0).at("memory").at("memory_id") == expired_id, "expired memory id mismatch");
    expect(expired_query.at("results").at(0).at("is_expired") == true, "expired query should mark result expired");

    auto conflict_old = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"conflict-topic",
          "summary":"旧事实",
          "layer":"task",
          "scope":{"task":"gamma"},
          "evidence":[{"kind":"note","value":"old"}]
        })"
    ));
    expect(conflict_old.at("status") == "success", "old conflict memory ingest should succeed");
    const std::string conflict_old_id = conflict_old.at("memory").at("memory_id").get<std::string>();

    auto conflict_new = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"conflict-topic",
          "summary":"新事实",
          "layer":"task",
          "scope":{"task":"gamma"},
          "mark_conflict":true,
          "evidence":[{"kind":"note","value":"new"}]
        })"
    ));
    expect(conflict_new.at("status") == "success", "new conflict memory ingest should succeed");
    expect(conflict_new.at("action") == "created_conflict", "new conflict action mismatch");

    auto conflict_old_loaded = parse_json(agent_core_memory_get(conflict_old_id.c_str()));
    expect(conflict_old_loaded.at("memory").at("status") == "conflicted", "old conflict memory should be marked conflicted");

    auto default_conflict_query = parse_json(agent_core_memory_query(R"({"topic":"conflict-topic"})"));
    expect(default_conflict_query.at("total_matches") == 1, "default query should hide conflicted entry");

    auto include_conflict_query = parse_json(agent_core_memory_query(
        R"({"topic":"conflict-topic","include_conflicted":true,"max_entries":10})"
    ));
    expect(include_conflict_query.at("total_matches") == 2, "query with include_conflicted should return both entries");

    auto inject_one = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"inject-topic",
          "summary":"第一条注入候选",
          "layer":"task",
          "scope":{"task":"one"},
          "evidence":[{"kind":"note","value":"one"}]
        })"
    ));
    expect(inject_one.at("status") == "success", "first injection candidate should succeed");
    auto inject_two = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"inject-topic",
          "summary":"第二条注入候选，长度更长一些以验证裁剪行为",
          "layer":"task",
          "scope":{"task":"two"},
          "evidence":[{"kind":"note","value":"two"}]
        })"
    ));
    expect(inject_two.at("status") == "success", "second injection candidate should succeed");

    auto truncated_query = parse_json(agent_core_memory_query(R"({"topic":"inject-topic"})"));
    expect_memory_query_contract(truncated_query);
    expect(truncated_query.at("total_matches") == 2, "inject topic should have two matches");
    expect(truncated_query.at("returned_matches") == 1, "configured max_injection_entries should truncate results");
    expect(truncated_query.at("injection").at("truncated") == true, "query should report truncation");
    expect(truncated_query.at("injection").at("omitted_count") == 1, "query omitted count mismatch");

    agent_core_shutdown();
    fs::remove(store_path);
    std::cout << "memory_execution_guard_test: PASS\n";
    return 0;
}
