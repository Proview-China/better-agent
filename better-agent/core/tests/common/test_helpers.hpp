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

} // namespace tests
} // namespace better_agent

#endif // BETTER_AGENT_TEST_HELPERS_HPP
