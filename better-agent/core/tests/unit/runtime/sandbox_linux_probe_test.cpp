#include <filesystem>
#include <iostream>
#include <string>

#include "agent_core.h"
#include "test_helpers.hpp"

int main() {
    using better_agent::tests::expect;
    using better_agent::tests::parse_json;

    namespace fs = std::filesystem;

    expect(agent_core_init() == 0, "agent_core_init should succeed");

    auto probe = parse_json(agent_core_sandbox_probe(nullptr));
    expect(probe.at("status") == "success", "sandbox probe should succeed");
    expect(probe.contains("platform"), "sandbox probe should report platform");
    expect(probe.contains("capabilities"), "sandbox probe should report capabilities");
    expect(probe.at("capabilities").contains("setrlimit"), "probe should include setrlimit");
    expect(probe.at("capabilities").contains("landlock"), "probe should include landlock");
    expect(probe.at("capabilities").contains("network_namespace"), "probe should include network namespace");
    expect(probe.at("capabilities").contains("cgroup_v2"), "probe should include cgroup v2");
    expect(probe.at("capabilities").contains("seccomp"), "probe should include seccomp");
    expect(probe.contains("supported_policy"), "probe should report supported policy");
    expect(probe.at("supported_policy").contains("linux_cgroup_mode"), "probe should report linux_cgroup_mode policy");
    expect(probe.at("supported_policy").contains("linux_seccomp_mode"), "probe should report linux_seccomp_mode policy");
    expect(probe.at("supported_policy").contains("linux_seccomp_profile"), "probe should report linux_seccomp_profile policy");

    const char *shell_tool = R"({
      "name":"shell_linux_probe",
      "description":"probe shell",
      "parameters":{
        "type":"object",
        "properties":{
          "command":{"type":"string"},
          "cwd":{"type":"string"}
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

    const std::string cwd = fs::current_path().string();
    const std::string allow_cwds_json = std::string("[\"") + cwd + "\"]";

    auto fs_required = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_linux_probe","arguments":{"command":"printf 'x'","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"allow_tools":["shell_linux_probe"],"allowed_commands":["printf"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"linux_filesystem_isolation":"required"})").c_str()
    ));

#if defined(__linux__)
    const std::string landlock_status = probe.at("capabilities").at("landlock").at("status").get<std::string>();
    if (landlock_status == "available") {
        expect(fs_required.at("status") != "blocked", "required filesystem isolation should not be blocked when Landlock is available");
        expect(fs_required.at("result").at("sandbox").at("linux").at("filesystem_isolation").at("status") == "enabled", "filesystem isolation should be enabled");
    } else {
        expect(fs_required.at("status") == "blocked", "required filesystem isolation should block when unavailable");
        expect(fs_required.at("error").at("error_code") == "E_SANDBOX_FILESYSTEM_UNSUPPORTED", "filesystem unsupported error mismatch");
    }
#else
    expect(fs_required.at("status") == "blocked", "non-linux platform should block required linux filesystem isolation");
    expect(fs_required.at("error").at("error_code") == "E_SANDBOX_FILESYSTEM_UNSUPPORTED", "filesystem unsupported error mismatch");
#endif

    auto fs_best_effort = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_linux_probe","arguments":{"command":"printf 'ok'","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"allow_tools":["shell_linux_probe"],"allowed_commands":["printf"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"linux_filesystem_isolation":"best_effort"})").c_str()
    ));
    expect(fs_best_effort.at("status") == "success", "best effort filesystem isolation should allow execution");
    expect(fs_best_effort.at("result").at("sandbox").at("linux").at("filesystem_isolation").contains("status"), "best effort result should expose filesystem isolation status");

    auto net_required = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_linux_probe","arguments":{"command":"printf 'offline'","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"allow_tools":["shell_linux_probe"],"allowed_commands":["printf"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"linux_network_isolation":"required","network_access":false})").c_str()
    ));

#if defined(__linux__)
    const std::string netns_status = probe.at("capabilities").at("network_namespace").at("status").get<std::string>();
    if (netns_status == "available") {
        expect(net_required.at("status") != "blocked", "required network isolation should not be blocked when netns is available");
        expect(net_required.at("result").at("sandbox").at("linux").at("network_isolation").at("status") == "enabled", "network isolation should be enabled");
    } else {
        expect(net_required.at("status") == "blocked", "required network isolation should block when unavailable");
        expect(net_required.at("error").at("error_code") == "E_SANDBOX_NETWORK_UNSUPPORTED", "network unsupported error mismatch");
    }
#else
    expect(net_required.at("status") == "blocked", "non-linux platform should block required linux network isolation");
    expect(net_required.at("error").at("error_code") == "E_SANDBOX_NETWORK_UNSUPPORTED", "network unsupported error mismatch");
#endif

    auto cgroup_required = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_linux_probe","arguments":{"command":"printf 'cg'","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"allow_tools":["shell_linux_probe"],"allowed_commands":["printf"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"linux_cgroup_mode":"required","cgroup_pids_max":32})").c_str()
    ));
#if defined(__linux__)
    const std::string cgroup_status = probe.at("capabilities").at("cgroup_v2").at("status").get<std::string>();
    if (cgroup_status == "available") {
        expect(cgroup_required.at("status") != "blocked", "required cgroup mode should not be blocked when available");
        expect(cgroup_required.at("result").at("sandbox").at("linux").at("cgroup_enforcement").contains("status"), "cgroup result should expose status");
    } else {
        expect(cgroup_required.at("status") == "blocked", "required cgroup mode should block when unavailable");
        expect(cgroup_required.at("error").at("error_code") == "E_SANDBOX_CGROUP_UNSUPPORTED", "cgroup unsupported error mismatch");
    }
#else
    expect(cgroup_required.at("status") == "blocked", "non-linux platform should block required cgroup mode");
    expect(cgroup_required.at("error").at("error_code") == "E_SANDBOX_CGROUP_UNSUPPORTED", "cgroup unsupported error mismatch");
#endif

    auto seccomp_required = parse_json(agent_core_execute_function_call(
        (std::string(R"({"tool":"shell_linux_probe","arguments":{"command":"printf 'sc'","cwd":")") + cwd + R"("}})").c_str(),
        (std::string(R"({"allow_tools":["shell_linux_probe"],"allowed_commands":["printf"],"allowed_cwds":)") + allow_cwds_json +
            R"(,"linux_seccomp_mode":"required","linux_seccomp_profile":"baseline"})").c_str()
    ));
#if defined(__linux__)
    const std::string seccomp_status = probe.at("capabilities").at("seccomp").at("status").get<std::string>();
    if (seccomp_status == "available") {
        expect(seccomp_required.at("status") != "blocked", "required seccomp mode should not be blocked when available");
        expect(seccomp_required.at("result").at("sandbox").at("linux").at("seccomp").contains("status"), "seccomp result should expose status");
    } else {
        expect(seccomp_required.at("status") == "blocked", "required seccomp mode should block when unavailable");
        expect(seccomp_required.at("error").at("error_code") == "E_SANDBOX_SECCOMP_UNSUPPORTED", "seccomp unsupported error mismatch");
    }
#else
    expect(seccomp_required.at("status") == "blocked", "non-linux platform should block required seccomp mode");
    expect(seccomp_required.at("error").at("error_code") == "E_SANDBOX_SECCOMP_UNSUPPORTED", "seccomp unsupported error mismatch");
#endif

    agent_core_shutdown();
    std::cout << "sandbox_linux_probe_test: PASS\n";
    return 0;
}
