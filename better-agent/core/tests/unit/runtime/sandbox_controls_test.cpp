#include <chrono>
#include <filesystem>
#include <future>
#include <iostream>
#include <string>
#include <thread>

#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::expect_execution_record_contract;
    using better_agent::tests::parse_json;

    namespace fs = std::filesystem;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    const char *shell_tool = R"({
      "name":"shell_echo",
      "description":"posix shell echo",
      "parameters":{
        "type":"object",
        "properties":{
          "command":{"type":"string"},
          "cwd":{"type":"string"},
          "shell":{"type":"string"},
          "requires_network":{"type":"boolean"}
        },
        "required":["command"],
        "additionalProperties":false
      },
      "constraints":{
        "tool_kind":"shell",
        "executor_kind":"builtin",
        "executor_target":"builtin.shell.posix"
      }
    })";
    expect(agent_core_register_tool(shell_tool) == 0, "shell tool registration should succeed");

    const char *code_tool = R"({
      "name":"run_code",
      "description":"posix code runner",
      "parameters":{
        "type":"object",
        "properties":{
          "source":{"type":"string"},
          "runtime":{"type":"string"},
          "cwd":{"type":"string"},
          "requires_network":{"type":"boolean"}
        },
        "required":["source"],
        "additionalProperties":false
      },
      "constraints":{
        "tool_kind":"code",
        "executor_kind":"builtin",
        "executor_target":"builtin.code.posix"
      }
    })";
    expect(agent_core_register_tool(code_tool) == 0, "code tool registration should succeed");

    const std::string cwd = fs::current_path().string();
    const std::string allow_cwds_json = std::string("[\"") + cwd + "\"]";
    const std::string network_code_json =
        std::string("{\"tool\":\"run_code\",\"arguments\":{\"source\":\"print('hi')\",\"runtime\":\"python3\",\"cwd\":\"") +
        cwd + "\",\"requires_network\":true}}";

    auto timeout_record = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_echo","arguments":{"command":"sleep 2","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"execution_id":"sandbox-timeout","allow_tools":["shell_echo"],"allowed_commands":["sleep"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"timeout_ms":100})").c_str()
    ));
    expect_execution_record_contract(timeout_record);
    expect(timeout_record.at("status") == "timeout", "timeout record should use timeout status");
    expect(timeout_record.at("error").at("error_code") == "E_SANDBOX_TIMEOUT", "timeout error mismatch");
    expect(timeout_record.at("result").at("sandbox").at("timed_out") == true, "timeout sandbox metadata mismatch");

    auto interrupt_future = std::async(std::launch::async, [&cwd, &allow_cwds_json]() {
        const std::string call_json =
            std::string(R"({"tool":"shell_echo","arguments":{"command":"sleep 5","cwd":")") + cwd + R"("}})";
        const std::string policy_json =
            std::string(R"({"execution_id":"sandbox-interrupt","allow_tools":["shell_echo"],"allowed_commands":["sleep"],"allowed_cwds":)") + allow_cwds_json + "}";
        return better_agent::tests::parse_json(agent_core_execute_function_call(call_json.c_str(), policy_json.c_str()));
    });
    std::this_thread::sleep_for(std::chrono::milliseconds(150));
    auto interrupt_result = parse_json(agent_core_interrupt_execution("sandbox-interrupt"));
    expect(interrupt_result.at("status") == "success", "interrupt API should succeed");
    auto interrupted_record = interrupt_future.get();
    expect_execution_record_contract(interrupted_record);
    expect(interrupted_record.at("status") == "interrupted", "interrupted record should use interrupted status");
    expect(interrupted_record.at("error").at("error_code") == "E_SANDBOX_INTERRUPTED", "interrupt error mismatch");
    expect(interrupted_record.at("result").at("sandbox").at("interrupted") == true, "interrupt sandbox metadata mismatch");

    auto network_disabled = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_echo","arguments":{"command":"curl https://example.test","cwd":")") + cwd + R"(","requires_network":true}})").c_str(),
        (std::string(R"({"allow_tools":["shell_echo"],"allowed_commands":["curl"],"allowed_cwds":)") + allow_cwds_json + R"(,"network_access":false})").c_str()
    ));
    expect(network_disabled.at("status") == "blocked", "network disabled should block");
    expect(network_disabled.at("error").at("error_code") == "E_SANDBOX_NETWORK_DISABLED", "network disabled error mismatch");

    auto network_unsupported = parse_json(agent_core_execute_function_call(
        network_code_json.c_str(),
        (std::string(R"({"allow_tools":["run_code"],"allowed_runtimes":["python3"],"allowed_cwds":)") + allow_cwds_json + R"(,"network_access":true})").c_str()
    ));
    expect(network_unsupported.at("status") == "blocked", "network unsupported should block");
    expect(network_unsupported.at("error").at("error_code") == "E_SANDBOX_NETWORK_UNSUPPORTED", "network unsupported error mismatch");

    auto truncated_record = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_echo","arguments":{"command":"printf '123456789'","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"allow_tools":["shell_echo"],"allowed_commands":["printf"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"max_stdout_bytes":4,"max_artifacts":2})").c_str()
    ));
    expect(truncated_record.at("status") == "success", "truncated command should still succeed");
    expect(truncated_record.at("result").at("stdout") == "1234", "stdout should be truncated");
    expect(truncated_record.at("result").at("stdout_truncated") == true, "stdout truncated flag mismatch");
    expect(truncated_record.at("result").at("artifacts").size() == 2, "artifact list should be truncated");
    expect(truncated_record.at("result").at("artifacts_truncated") == true, "artifact truncation flag mismatch");

    agent_core_shutdown();
    std::cout << "sandbox_controls_test: PASS\n";
    return 0;
}
