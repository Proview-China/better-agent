#include "agent_core_internal.hpp"

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

namespace better_agent::core_internal {

std::atomic<unsigned long long> g_seq{1};
thread_local std::string g_last_error;
thread_local std::string g_last_output;
std::mutex g_tools_mu;
std::unordered_map<std::string, ToolRegistration> g_tools;
std::unordered_map<std::string, ExecutionRecord> g_executions;
std::unordered_map<std::string, std::string> g_idempotency_to_execution;
std::unordered_map<std::string, std::string> g_idempotency_signature;

std::string now_iso8601_utc() {
    const auto now = std::chrono::system_clock::now();
    const auto tt = std::chrono::system_clock::to_time_t(now);
    std::tm tm {};
#if defined(_WIN32)
    gmtime_s(&tm, &tt);
#else
    gmtime_r(&tt, &tm);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

std::string next_id(const std::string &prefix) {
    const auto seq = g_seq.fetch_add(1, std::memory_order_relaxed);
    return prefix + "-" + std::to_string(seq);
}

} // namespace better_agent::core_internal
