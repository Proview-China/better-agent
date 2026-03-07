#ifndef BETTER_AGENT_TEST_HELPERS_HPP
#define BETTER_AGENT_TEST_HELPERS_HPP

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include "nlohmann/json.hpp"

namespace better_agent {
namespace tests {

inline nlohmann::json parse_json(const char *text) {
    if (text == nullptr) {
        throw std::runtime_error("received null JSON text");
    }
    return nlohmann::json::parse(text);
}

inline void expect(bool condition, const std::string &message) {
    if (!condition) {
        std::cerr << "[FAIL] " << message << "\n";
        std::exit(1);
    }
}

inline void expect_has_key(const nlohmann::json &obj, const char *key, const std::string &message) {
    expect(obj.is_object(), message + " (expected object)");
    expect(obj.contains(key), message + " (missing key: " + key + ")");
}

inline void expect_execution_record_contract(const nlohmann::json &record) {
    expect_has_key(record, "execution_id", "execution record contract");
    expect_has_key(record, "tool_kind", "execution record contract");
    expect_has_key(record, "provider_kind", "execution record contract");
    expect_has_key(record, "intent", "execution record contract");
    expect_has_key(record, "provider_call_id", "execution record contract");
    expect_has_key(record, "input_raw", "execution record contract");
    expect_has_key(record, "input_normalized", "execution record contract");
    expect_has_key(record, "policy_snapshot", "execution record contract");
    expect_has_key(record, "status", "execution record contract");
    expect_has_key(record, "evidence", "execution record contract");
    expect_has_key(record, "error", "execution record contract");
    expect_has_key(record, "handoff", "execution record contract");
    expect_has_key(record, "timestamp", "execution record contract");
}

inline void expect_provider_wrapper_contract(const nlohmann::json &wrapper) {
    expect_has_key(wrapper, "execution", "provider wrapper contract");
    expect_has_key(wrapper, "provider_payload", "provider wrapper contract");
    expect_has_key(wrapper, "sdk", "provider wrapper contract");
}

inline void expect_runtime_record_contract(const nlohmann::json &record) {
    expect_has_key(record, "execution_id", "runtime record contract");
    expect_has_key(record, "source", "runtime record contract");
    expect_has_key(record, "event_type", "runtime record contract");
    expect_has_key(record, "tool_kind", "runtime record contract");
    expect_has_key(record, "intent", "runtime record contract");
    expect_has_key(record, "input_raw", "runtime record contract");
    expect_has_key(record, "input_normalized", "runtime record contract");
    expect_has_key(record, "policy_snapshot", "runtime record contract");
    expect_has_key(record, "status", "runtime record contract");
    expect_has_key(record, "evidence", "runtime record contract");
    expect_has_key(record, "error", "runtime record contract");
    expect_has_key(record, "handoff", "runtime record contract");
    expect_has_key(record, "timestamp", "runtime record contract");
}

inline void expect_memory_entry_contract(const nlohmann::json &entry) {
    expect_has_key(entry, "memory_id", "memory entry contract");
    expect_has_key(entry, "topic", "memory entry contract");
    expect_has_key(entry, "kind", "memory entry contract");
    expect_has_key(entry, "layer", "memory entry contract");
    expect_has_key(entry, "scope", "memory entry contract");
    expect_has_key(entry, "summary", "memory entry contract");
    expect_has_key(entry, "evidence", "memory entry contract");
    expect_has_key(entry, "confidence", "memory entry contract");
    expect_has_key(entry, "created_at", "memory entry contract");
    expect_has_key(entry, "updated_at", "memory entry contract");
    expect_has_key(entry, "expires_at", "memory entry contract");
    expect_has_key(entry, "status", "memory entry contract");
    expect_has_key(entry, "supersedes", "memory entry contract");
    expect_has_key(entry, "conflicts_with", "memory entry contract");
    expect_has_key(entry, "source", "memory entry contract");
}

inline void expect_memory_query_contract(const nlohmann::json &result) {
    expect_has_key(result, "status", "memory query contract");
    expect_has_key(result, "query", "memory query contract");
    expect_has_key(result, "total_matches", "memory query contract");
    expect_has_key(result, "returned_matches", "memory query contract");
    expect_has_key(result, "results", "memory query contract");
    expect_has_key(result, "injection", "memory query contract");
}

} // namespace tests
} // namespace better_agent

#endif // BETTER_AGENT_TEST_HELPERS_HPP
