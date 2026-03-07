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

} // namespace

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_memory_entry_contract;
    using better_agent::tests::expect_memory_query_contract;
    using better_agent::tests::parse_json;

    namespace fs = std::filesystem;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const std::string store_path = make_store_path("store-query");
    const std::string configure_json =
        std::string(R"({"store_path":")") + store_path + R"(","max_injection_entries":4,"max_injection_chars":1200})";
    auto configured = parse_json(agent_core_memory_configure(configure_json.c_str()));
    expect(configured.at("status") == "success", "memory configure should succeed");

    auto reset_before = parse_json(agent_core_memory_reset());
    expect(reset_before.at("status") == "success", "memory reset should succeed before ingest");

    auto first_ingest = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"project-memory",
          "summary":"核心层必须统一处理记忆决策逻辑",
          "layer":"task",
          "scope":{"task":"alpha"},
          "evidence":[{"kind":"note","value":"design"}],
          "source":{"author":"test"}
        })"
    ));
    expect(first_ingest.at("status") == "success", "first ingest should succeed");
    expect(first_ingest.at("action") == "created", "first ingest action mismatch");
    expect_memory_entry_contract(first_ingest.at("memory"));
    const std::string first_id = first_ingest.at("memory").at("memory_id").get<std::string>();

    auto updated_ingest = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"project-memory",
          "summary":"核心层必须统一处理记忆决策逻辑",
          "layer":"task",
          "scope":{"task":"alpha"},
          "evidence":[{"kind":"note","value":"updated"}],
          "source":{"author":"test-updated"}
        })"
    ));
    expect(updated_ingest.at("status") == "success", "update ingest should succeed");
    expect(updated_ingest.at("action") == "updated", "update ingest action mismatch");
    expect(updated_ingest.at("memory").at("memory_id") == first_id, "updated ingest should reuse memory id");

    auto superseding_ingest = parse_json(agent_core_memory_ingest(
        R"({
          "input_type":"conclusion",
          "topic":"project-memory",
          "summary":"核心层必须把记忆排序、冲突处理和注入裁剪全部留在 core",
          "layer":"task",
          "scope":{"task":"alpha"},
          "evidence":[{"kind":"note","value":"new-evidence"}],
          "source":{"author":"test-new"}
        })"
    ));
    expect(superseding_ingest.at("status") == "success", "superseding ingest should succeed");
    expect(superseding_ingest.at("action") == "created_superseding", "superseding ingest action mismatch");
    expect_memory_entry_contract(superseding_ingest.at("memory"));
    const std::string second_id = superseding_ingest.at("memory").at("memory_id").get<std::string>();
    expect(second_id != first_id, "superseding ingest should create a new memory");

    auto first_loaded = parse_json(agent_core_memory_get(first_id.c_str()));
    expect(first_loaded.at("status") == "success", "memory get should succeed");
    expect_memory_entry_contract(first_loaded.at("memory"));
    expect(first_loaded.at("memory").at("status") == "superseded", "old memory should be superseded");

    auto second_loaded = parse_json(agent_core_memory_get(second_id.c_str()));
    expect(second_loaded.at("status") == "success", "new memory get should succeed");
    expect_memory_entry_contract(second_loaded.at("memory"));
    expect(second_loaded.at("memory").at("status") == "active", "new memory should stay active");

    auto query = parse_json(agent_core_memory_query(
        R"({
          "topic":"project-memory",
          "layers":["task"],
          "scope":{"task":"alpha"}
        })"
    ));
    expect(query.at("status") == "success", "memory query should succeed");
    expect_memory_query_contract(query);
    expect(query.at("total_matches") == 1, "default query should hide superseded memory");
    expect(query.at("returned_matches") == 1, "query should return one active memory");
    expect(query.at("results").at(0).at("memory").at("memory_id") == second_id, "query should return latest memory");
    expect(query.at("results").at(0).at("reasons").is_array(), "query reasons should be an array");

    agent_core_shutdown();
    expect(agent_core_init() == 0, "agent_core_init after restart should succeed");
    configured = parse_json(agent_core_memory_configure(configure_json.c_str()));
    expect(configured.at("status") == "success", "memory configure after restart should succeed");
    auto query_after_restart = parse_json(agent_core_memory_query(
        R"({
          "topic":"project-memory",
          "layers":["task"],
          "scope":{"task":"alpha"}
        })"
    ));
    expect(query_after_restart.at("status") == "success", "query after restart should succeed");
    expect(query_after_restart.at("total_matches") == 1, "persisted memory should be reloaded");
    expect(query_after_restart.at("results").at(0).at("memory").at("memory_id") == second_id, "reloaded memory id mismatch");

    auto reset_after = parse_json(agent_core_memory_reset());
    expect(reset_after.at("status") == "success", "memory reset should succeed after restart");
    auto empty_query = parse_json(agent_core_memory_query(R"({"topic":"project-memory"})"));
    expect(empty_query.at("total_matches") == 0, "memory reset should clear entries");

    agent_core_shutdown();
    fs::remove(store_path);
    std::cout << "memory_store_query_test: PASS\n";
    return 0;
}
