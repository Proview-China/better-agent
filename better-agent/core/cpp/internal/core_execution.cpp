#include "agent_core_internal.hpp"

#include <cstdlib>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>

#if defined(__APPLE__) || defined(__linux__)
    #include <sys/wait.h>
#endif

namespace better_agent::core_internal {

namespace {

namespace fs = std::filesystem;

using BuiltinExecutorFn = ToolExecutionResult (*)(const ToolRegistration &, const ToolExecutionRequest &);

std::string current_platform_name(const json &policy) {
    const std::string override_name = get_string_or(policy, "platform_override");
    if (!override_name.empty()) {
        return override_name;
    }
#if defined(__APPLE__)
    return "macos";
#elif defined(__linux__)
    return "linux";
#elif defined(_WIN32)
    return "windows";
#else
    return "unknown";
#endif
}

bool is_posix_platform(const json &policy) {
    const std::string platform_name = current_platform_name(policy);
    return platform_name == "macos" || platform_name == "linux";
}

std::string quote_for_shell(const std::string &value) {
    std::string escaped = "'";
    for (const char ch : value) {
        if (ch == '\'') {
            escaped += "'\\''";
        } else {
            escaped.push_back(ch);
        }
    }
    escaped.push_back('\'');
    return escaped;
}

std::string read_text_file(const fs::path &file_path) {
    std::ifstream in(file_path);
    std::ostringstream buffer;
    buffer << in.rdbuf();
    return buffer.str();
}

void append_evidence(json *target, const json &items) {
    if (!target->is_array()) {
        *target = json::array();
    }
    if (items.is_array()) {
        for (const auto &item : items) {
            target->push_back(item);
        }
    } else if (!items.is_null()) {
        target->push_back(items);
    }
}

ToolExecutionResult make_execution_result(
    const std::string &status,
    const json &result,
    const json &error,
    const json &evidence,
    const std::string &handoff
) {
    return ToolExecutionResult{
        .status = status,
        .result = result,
        .error = error,
        .evidence = evidence,
        .handoff = handoff
    };
}

ToolExecutionResult make_executor_error(
    const std::string &status,
    const std::string &error_code,
    const std::string &message,
    const json &detail,
    const std::string &executor_target,
    const std::string &handoff = "manual_takeover"
) {
    return make_execution_result(
        status,
        json::object(),
        json{
            {"error_code", error_code},
            {"message", message},
            {"detail", detail}
        },
        json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        handoff
    );
}

std::string resolve_shell_runner(const json &args) {
    const std::string requested = get_string_or(args, "shell", "sh");
    if (requested == "sh") {
        return "/bin/sh";
    }
    if (requested == "bash") {
        return "/bin/bash";
    }
    if (requested == "zsh") {
        return "/bin/zsh";
    }
    if (requested == "pwsh" || requested == "powershell") {
        return "powershell";
    }
    return requested;
}

std::string first_command_token(const std::string &command) {
    std::string token;
    bool in_whitespace = true;
    for (const char ch : command) {
        if (std::isspace(static_cast<unsigned char>(ch)) != 0) {
            if (!in_whitespace) {
                break;
            }
            continue;
        }
        in_whitespace = false;
        token.push_back(ch);
    }
    return token;
}

bool string_allowed_by_policy(const json &policy_list, const std::string &value) {
    if (!policy_list.is_array() || policy_list.empty()) {
        return true;
    }
    for (const auto &entry : policy_list) {
        if (entry.is_string() && entry.get<std::string>() == value) {
            return true;
        }
    }
    return false;
}

fs::path normalize_path_for_policy(const fs::path &path_value) {
    std::error_code error;
    const fs::path absolute_path = fs::absolute(path_value, error);
    if (error) {
        return path_value.lexically_normal();
    }
    return absolute_path.lexically_normal();
}

bool path_is_within(const fs::path &candidate, const fs::path &allowed_root) {
    const fs::path normalized_candidate = normalize_path_for_policy(candidate);
    const fs::path normalized_root = normalize_path_for_policy(allowed_root);

    auto root_it = normalized_root.begin();
    auto root_end = normalized_root.end();
    auto candidate_it = normalized_candidate.begin();
    auto candidate_end = normalized_candidate.end();
    while (root_it != root_end && candidate_it != candidate_end) {
        if (*root_it != *candidate_it) {
            return false;
        }
        ++root_it;
        ++candidate_it;
    }
    return root_it == root_end;
}

bool cwd_allowed_by_policy(const json &policy, const fs::path &cwd) {
    const json allowed_cwds = policy.value("allowed_cwds", json::array());
    if (!allowed_cwds.is_array() || allowed_cwds.empty()) {
        return true;
    }
    for (const auto &entry : allowed_cwds) {
        if (entry.is_string() && path_is_within(cwd, fs::path(entry.get<std::string>()))) {
            return true;
        }
    }
    return false;
}

ToolExecutionResult run_process_in_temp_dir(
    const std::string &executor_target,
    const fs::path &cwd,
    const std::string &runner_command,
    const json &result_metadata
) {
    const fs::path temp_dir = fs::temp_directory_path() / next_id("agent-core");
    fs::create_directories(temp_dir);

    const fs::path wrapper_path = temp_dir / "run.sh";
    const fs::path stdout_path = temp_dir / "stdout.txt";
    const fs::path stderr_path = temp_dir / "stderr.txt";
    std::ofstream wrapper(wrapper_path);
    wrapper << "cd " << quote_for_shell(cwd.string()) << " || exit 97\n";
    wrapper << runner_command << "\n";
    wrapper.close();

    const std::string system_command = "/bin/sh " + quote_for_shell(wrapper_path.string()) +
        " > " + quote_for_shell(stdout_path.string()) +
        " 2> " + quote_for_shell(stderr_path.string());

    const int raw_exit_code = std::system(system_command.c_str());
    int exit_code = raw_exit_code;
#if defined(__APPLE__) || defined(__linux__)
    if (WIFEXITED(raw_exit_code)) {
        exit_code = WEXITSTATUS(raw_exit_code);
    } else if (WIFSIGNALED(raw_exit_code)) {
        exit_code = 128 + WTERMSIG(raw_exit_code);
    }
#endif

    json result = result_metadata;
    result["cwd"] = cwd.string();
    result["stdout"] = read_text_file(stdout_path);
    result["stderr"] = read_text_file(stderr_path);
    result["exit_code"] = exit_code;
    result["artifacts"] = json::array({
        json{{"path", wrapper_path.string()}, {"kind", "runner"}},
        json{{"path", stdout_path.string()}, {"kind", "stdout"}},
        json{{"path", stderr_path.string()}, {"kind", "stderr"}}
    });

    json evidence = json::array({
        json{{"kind", "executor_kind"}, {"value", "builtin"}},
        json{{"kind", "executor_target"}, {"value", executor_target}},
        json{{"kind", "cwd"}, {"value", cwd.string()}},
        json{{"kind", "artifact_dir"}, {"value", temp_dir.string()}}
    });

    const std::string status = exit_code == 0 ? "success" : "failed";
    return make_execution_result(
        status,
        result,
        exit_code == 0
            ? nullptr
            : json{
                {"error_code", "E_EXECUTION_FAILED"},
                {"message", "executor returned non-zero exit code"},
                {"detail", json{{"exit_code", exit_code}}}
            },
        evidence,
        default_handoff(status)
    );
}

ToolExecutionResult execute_builtin_echo(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    return make_execution_result(
        "success",
        json{{"ok", true}, {"echo", request.args}},
        nullptr,
        json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        "continue"
    );
}

ToolExecutionResult execute_builtin_hook_echo(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    std::string decision = get_string_or(request.args, "decision");
    if (decision.empty() && tool.spec.constraints.is_object()) {
        decision = get_string_or(tool.spec.constraints, "default_decision", "continue");
    }
    if (decision != "block") {
        decision = "continue";
    }
    const std::string reason = get_string_or(request.args, "reason", get_string_or(tool.spec.constraints, "default_reason"));
    const std::string status = decision == "block" ? "blocked" : "success";
    return make_execution_result(
        status,
        json{
            {"decision", decision},
            {"reason", reason},
            {"phase", get_string_or(request.args, "phase")},
            {"target_tool", get_string_or(request.args, "target_tool")}
        },
        nullptr,
        json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}},
            json{{"kind", "hook_decision"}, {"value", decision}}
        }),
        decision == "block" ? "manual_takeover" : "continue"
    );
}

ToolExecutionResult execute_builtin_hook_fail(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    (void)request;
    const std::string executor_target = resolve_executor_target(tool);
    return make_executor_error(
        "failed",
        "E_HOOK_FAILED",
        "hook executor failed intentionally",
        json::object(),
        executor_target
    );
}

ToolExecutionResult execute_builtin_web_fixture(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    const std::string query = get_string_or(request.args, "query");
    json items = request.args.value("fixture_results", json());
    if (!items.is_array()) {
        const json fixture_map = request.policy.value("web_fixture_results", json::object());
        if (fixture_map.is_object() && fixture_map.contains(query)) {
            items = fixture_map.at(query);
        }
    }
    if (!items.is_array()) {
        return make_executor_error(
            "blocked",
            "E_WEB_ADAPTER_UNAVAILABLE",
            "web fixture adapter is not configured",
            json{{"query", query}},
            executor_target
        );
    }

    json evidence = json::array({
        json{{"kind", "executor_kind"}, {"value", "builtin"}},
        json{{"kind", "executor_target"}, {"value", executor_target}}
    });
    for (const auto &item : items) {
        if (!item.is_object()) {
            continue;
        }
        evidence.push_back(json{
            {"kind", "web_result"},
            {"title", get_string_or(item, "title")},
            {"url", get_string_or(item, "url")},
            {"source", get_string_or(item, "source")}
        });
    }

    return make_execution_result(
        "success",
        json{{"query", query}, {"items", items}},
        nullptr,
        evidence,
        "continue"
    );
}

ToolExecutionResult execute_builtin_computer_fixture(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    json fixture = request.args.value("fixture_result", json());
    if (!fixture.is_object()) {
        fixture = request.policy.value("computer_fixture_result", json());
    }
    if (!fixture.is_object()) {
        return make_executor_error(
            "blocked",
            "E_COMPUTER_ADAPTER_UNAVAILABLE",
            "computer fixture adapter is not configured",
            json{{"goal", get_string_or(request.args, "goal")}},
            executor_target
        );
    }

    json evidence = json::array({
        json{{"kind", "executor_kind"}, {"value", "builtin"}},
        json{{"kind", "executor_target"}, {"value", executor_target}},
        json{{"kind", "computer_goal"}, {"value", get_string_or(request.args, "goal")}}
    });
    return make_execution_result("success", fixture, nullptr, evidence, "continue");
}

ToolExecutionResult execute_builtin_skills_fixture(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    if (request.args.contains("fixture_result") && request.args.at("fixture_result").is_object()) {
        return make_execution_result(
            "success",
            request.args.at("fixture_result"),
            nullptr,
            json::array({
                json{{"kind", "executor_kind"}, {"value", "builtin"}},
                json{{"kind", "executor_target"}, {"value", executor_target}}
            }),
            "continue"
        );
    }

    const std::string skill_path_value = get_string_or(request.args, "skill_path");
    if (skill_path_value.empty()) {
        return make_executor_error(
            "failed",
            "E_SKILL_INPUT",
            "skill_path is required",
            json::object(),
            executor_target
        );
    }

    const fs::path skill_path(skill_path_value);
    const json allowed_roots = request.policy.value("allowed_skill_roots", json::array());
    if (allowed_roots.is_array() && !allowed_roots.empty()) {
        bool path_allowed = false;
        for (const auto &root_entry : allowed_roots) {
            if (root_entry.is_string() && path_is_within(skill_path, fs::path(root_entry.get<std::string>()))) {
                path_allowed = true;
                break;
            }
        }
        if (!path_allowed) {
            return make_executor_error(
                "blocked",
                "E_SKILL_POLICY_DENY",
                "skill path is not allowed by policy",
                json{{"skill_path", skill_path.string()}},
                executor_target
            );
        }
    }

    if (!fs::exists(skill_path) || !fs::is_regular_file(skill_path)) {
        return make_executor_error(
            "failed",
            "E_SKILL_NOT_FOUND",
            "skill file does not exist",
            json{{"skill_path", skill_path.string()}},
            executor_target
        );
    }

    const std::string content = read_text_file(skill_path);
    const std::string excerpt = content.substr(0, 400);
    return make_execution_result(
        "success",
        json{
            {"skill_path", skill_path.string()},
            {"content_excerpt", excerpt},
            {"size_bytes", content.size()}
        },
        nullptr,
        json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}},
            json{{"kind", "skill_path"}, {"value", skill_path.string()}}
        }),
        "continue"
    );
}

ToolExecutionResult execute_builtin_mcp_fixture(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    json response = request.args.value("fixture_response", json());
    const std::string server = get_string_or(request.args, "server");
    const std::string remote_tool = get_string_or(request.args, "remote_tool");

    if (!response.is_object()) {
        const json fixture_map = request.policy.value("mcp_fixture_responses", json::object());
        const std::string fixture_key = server + "::" + remote_tool;
        if (fixture_map.is_object() && fixture_map.contains(fixture_key)) {
            response = fixture_map.at(fixture_key);
        }
    }
    if (!response.is_object()) {
        return make_executor_error(
            "blocked",
            "E_MCP_ADAPTER_UNAVAILABLE",
            "mcp fixture adapter is not configured",
            json{{"server", server}, {"remote_tool", remote_tool}},
            executor_target
        );
    }

    return make_execution_result(
        "success",
        json{{"server", server}, {"remote_tool", remote_tool}, {"response", response}},
        nullptr,
        json::array({
            json{{"kind", "executor_kind"}, {"value", "builtin"}},
            json{{"kind", "executor_target"}, {"value", executor_target}},
            json{{"kind", "mcp_server"}, {"value", server}},
            json{{"kind", "mcp_tool"}, {"value", remote_tool}}
        }),
        "continue"
    );
}

ToolExecutionResult execute_builtin_shell_posix(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    if (!is_posix_platform(request.policy)) {
        return make_executor_error(
            "blocked",
            "E_PLATFORM_UNSUPPORTED",
            "POSIX shell executor supports only macOS and Linux",
            json{{"platform", current_platform_name(request.policy)}},
            executor_target
        );
    }

    const std::string command = get_string_or(request.args, "command");
    if (command.empty()) {
        return make_executor_error(
            "failed",
            "E_SHELL_INPUT",
            "shell command is required",
            json::object(),
            executor_target
        );
    }

    const std::string shell_runner = resolve_shell_runner(request.args);
    if (shell_runner == "powershell") {
        return make_executor_error(
            "blocked",
            "E_PLATFORM_UNSUPPORTED",
            "PowerShell is not supported by the POSIX shell executor",
            json{{"shell", get_string_or(request.args, "shell", "sh")}},
            executor_target
        );
    }

    const std::string command_token = first_command_token(command);
    if (!string_allowed_by_policy(request.policy.value("allowed_commands", json::array()), command_token)) {
        return make_executor_error(
            "blocked",
            "E_POLICY_DENY",
            "shell command is not allowed by policy",
            json{{"command", command_token}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }

    const fs::path cwd = request.args.contains("cwd") && request.args.at("cwd").is_string()
        ? fs::path(request.args.at("cwd").get<std::string>())
        : fs::current_path();
    if (!cwd_allowed_by_policy(request.policy, cwd)) {
        return make_executor_error(
            "blocked",
            "E_POLICY_DENY",
            "working directory is not allowed by policy",
            json{{"cwd", cwd.string()}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }

    const fs::path temp_dir = fs::temp_directory_path() / next_id("shell");
    fs::create_directories(temp_dir);
    const fs::path script_path = temp_dir / "command.sh";
    std::ofstream script(script_path);
    script << "cd " << quote_for_shell(cwd.string()) << " || exit 97\n";
    script << command << "\n";
    script.close();

    json result_metadata{
        {"command", command},
        {"shell", shell_runner}
    };
    ToolExecutionResult execution = run_process_in_temp_dir(
        executor_target,
        cwd,
        quote_for_shell(shell_runner) + " " + quote_for_shell(script_path.string()),
        result_metadata
    );
    execution.result["artifacts"].push_back(json{{"path", script_path.string()}, {"kind", "script"}});
    execution.evidence.push_back(json{{"kind", "shell"}, {"value", shell_runner}});
    return execution;
}

std::string resolve_code_runtime(const json &args) {
    const std::string runtime = get_string_or(args, "runtime", "sh");
    if (runtime == "sh") {
        return "sh";
    }
    if (runtime == "bash") {
        return "bash";
    }
    if (runtime == "zsh") {
        return "zsh";
    }
    if (runtime == "python") {
        return "python3";
    }
    if (runtime == "python3" || runtime == "node") {
        return runtime;
    }
    return runtime;
}

std::string code_extension_for_runtime(const std::string &runtime) {
    if (runtime == "python3") {
        return ".py";
    }
    if (runtime == "node") {
        return ".js";
    }
    if (runtime == "zsh") {
        return ".zsh";
    }
    if (runtime == "bash") {
        return ".bash";
    }
    return ".sh";
}

ToolExecutionResult execute_builtin_code_posix(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    if (!is_posix_platform(request.policy)) {
        return make_executor_error(
            "blocked",
            "E_PLATFORM_UNSUPPORTED",
            "POSIX code executor supports only macOS and Linux",
            json{{"platform", current_platform_name(request.policy)}},
            executor_target
        );
    }

    const std::string source = get_string_or(request.args, "source");
    if (source.empty()) {
        return make_executor_error(
            "failed",
            "E_CODE_INPUT",
            "code source is required",
            json::object(),
            executor_target
        );
    }

    const std::string runtime = resolve_code_runtime(request.args);
    if (runtime == "powershell" || runtime == "pwsh") {
        return make_executor_error(
            "blocked",
            "E_PLATFORM_UNSUPPORTED",
            "PowerShell is not supported by the POSIX code executor",
            json{{"runtime", runtime}},
            executor_target
        );
    }
    if (!string_allowed_by_policy(request.policy.value("allowed_runtimes", json::array()), runtime)) {
        return make_executor_error(
            "blocked",
            "E_POLICY_DENY",
            "runtime is not allowed by policy",
            json{{"runtime", runtime}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }

    const fs::path cwd = request.args.contains("cwd") && request.args.at("cwd").is_string()
        ? fs::path(request.args.at("cwd").get<std::string>())
        : fs::current_path();
    if (!cwd_allowed_by_policy(request.policy, cwd)) {
        return make_executor_error(
            "blocked",
            "E_POLICY_DENY",
            "working directory is not allowed by policy",
            json{{"cwd", cwd.string()}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }

    const fs::path temp_dir = fs::temp_directory_path() / next_id("code");
    fs::create_directories(temp_dir);
    const fs::path source_path = temp_dir / ("snippet" + code_extension_for_runtime(runtime));
    std::ofstream out(source_path);
    out << source;
    out.close();

    std::string command = quote_for_shell(runtime) + " " + quote_for_shell(source_path.string());
    const json argv = request.args.value("argv", json::array());
    if (argv.is_array()) {
        for (const auto &entry : argv) {
            if (entry.is_string()) {
                command += " " + quote_for_shell(entry.get<std::string>());
            }
        }
    }

    ToolExecutionResult execution = run_process_in_temp_dir(
        executor_target,
        cwd,
        command,
        json{{"runtime", runtime}}
    );
    execution.result["artifacts"].push_back(json{{"path", source_path.string()}, {"kind", "source"}});
    execution.evidence.push_back(json{{"kind", "runtime"}, {"value", runtime}});
    return execution;
}

const std::unordered_map<std::string, BuiltinExecutorFn> &builtin_executor_registry() {
    static const std::unordered_map<std::string, BuiltinExecutorFn> kRegistry = {
        {"builtin.echo", &execute_builtin_echo},
        {"builtin.hook.echo", &execute_builtin_hook_echo},
        {"builtin.hook.fail", &execute_builtin_hook_fail},
        {"builtin.web.fixture", &execute_builtin_web_fixture},
        {"builtin.computer.fixture", &execute_builtin_computer_fixture},
        {"builtin.skills.fixture", &execute_builtin_skills_fixture},
        {"builtin.mcp.fixture", &execute_builtin_mcp_fixture},
        {"builtin.shell.posix", &execute_builtin_shell_posix},
        {"builtin.code.posix", &execute_builtin_code_posix},
    };
    return kRegistry;
}

std::string hook_decision(const ToolExecutionResult &hook_execution) {
    if (hook_execution.result.is_object() && hook_execution.result.contains("decision") &&
        hook_execution.result.at("decision").is_string()) {
        return hook_execution.result.at("decision").get<std::string>();
    }
    if (hook_execution.status == "blocked" || hook_execution.status == "failed") {
        return "block";
    }
    return "continue";
}

json build_hook_payload(
    const std::string &phase,
    const ToolRegistration &target_tool,
    const ToolExecutionRequest &target_request,
    const ToolExecutionResult *target_result
) {
    json payload{
        {"phase", phase},
        {"target_tool", target_tool.spec.name},
        {"target_tool_kind", target_tool.tool_kind},
        {"request", json{
            {"tool_name", target_request.tool_name},
            {"tool_kind", target_request.tool_kind},
            {"provider_kind", target_request.provider_kind},
            {"intent", target_request.intent},
            {"provider_call_id", target_request.provider_call_id},
            {"args", target_request.args}
        }}
    };
    if (target_result != nullptr) {
        payload["result"] = json{
            {"status", target_result->status},
            {"result", target_result->result},
            {"error", target_result->error},
            {"handoff", target_result->handoff}
        };
    }
    return payload;
}

bool execute_hook_chain(
    const std::vector<std::string> &hook_names,
    const std::string &phase,
    const PolicyView &policy,
    const ToolRegistration &target_tool,
    const ToolExecutionRequest &target_request,
    const ToolExecutionResult *target_result,
    json *evidence_out,
    json *blocking_error_out
) {
    for (const auto &hook_name : hook_names) {
        const ToolRegistration *hook_tool = find_registered_tool(hook_name);
        if (hook_tool == nullptr) {
            evidence_out->push_back(json{
                {"kind", "hook"},
                {"phase", phase},
                {"hook_name", hook_name},
                {"status", "failed"},
                {"error", json{{"error_code", "E_HOOK_NOT_FOUND"}, {"message", "hook tool is not registered"}}}
            });
            if (phase == "before_tool") {
                *blocking_error_out = json{
                    {"error_code", "E_HOOK_NOT_FOUND"},
                    {"message", "before hook is not registered"},
                    {"detail", json{{"hook_name", hook_name}}}
                };
                return false;
            }
            continue;
        }

        if (hook_tool->tool_kind != "hooks") {
            evidence_out->push_back(json{
                {"kind", "hook"},
                {"phase", phase},
                {"hook_name", hook_name},
                {"status", "failed"},
                {"error", json{{"error_code", "E_HOOK_KIND"}, {"message", "registered hook tool must use hooks kind"}}}
            });
            if (phase == "before_tool") {
                *blocking_error_out = json{
                    {"error_code", "E_HOOK_KIND"},
                    {"message", "before hook tool_kind must be hooks"},
                    {"detail", json{{"hook_name", hook_name}}}
                };
                return false;
            }
            continue;
        }

        const ToolExecutionRequest hook_request{
            .tool_name = hook_tool->spec.name,
            .tool_kind = hook_tool->tool_kind,
            .provider_kind = target_request.provider_kind,
            .intent = "hook." + phase,
            .provider_call_id = target_request.provider_call_id,
            .args = build_hook_payload(phase, target_tool, target_request, target_result),
            .policy = policy.raw_json
        };
        const ToolExecutionResult hook_execution = execute_tool_registration(*hook_tool, hook_request);
        json hook_entry{
            {"kind", "hook"},
            {"phase", phase},
            {"hook_name", hook_name},
            {"status", hook_execution.status},
            {"handoff", hook_execution.handoff}
        };
        if (!hook_execution.result.is_null()) {
            hook_entry["result"] = hook_execution.result;
        }
        if (!hook_execution.error.is_null()) {
            hook_entry["error"] = hook_execution.error;
        }
        if (hook_execution.evidence.is_array() && !hook_execution.evidence.empty()) {
            hook_entry["hook_evidence"] = hook_execution.evidence;
        }
        evidence_out->push_back(hook_entry);

        if (phase == "before_tool" && hook_decision(hook_execution) == "block") {
            const std::string reason = hook_execution.result.is_object()
                ? get_string_or(hook_execution.result, "reason", "before hook blocked target tool")
                : std::string("before hook blocked target tool");
            *blocking_error_out = json{
                {"error_code", "E_HOOK_BLOCKED"},
                {"message", "before hook blocked target tool"},
                {"detail", json{{"hook_name", hook_name}, {"reason", reason}}}
            };
            return false;
        }
    }

    return true;
}

} // namespace

json resolve_mock_result(const ToolRegistration &tool, const json &args) {
    if (tool.mock_result.is_object() && !tool.mock_result.empty()) {
        return tool.mock_result;
    }
    return json{{"ok", true}, {"echo", args}};
}

ToolExecutionResult execute_mock_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    return ToolExecutionResult{
        .status = "success",
        .result = resolve_mock_result(tool, request.args),
        .error = nullptr,
        .evidence = json::array(),
        .handoff = "continue"
    };
}

std::string resolve_executor_target(const ToolRegistration &tool) {
    if (!tool.executor_target.empty()) {
        return tool.executor_target;
    }
    return tool.spec.name;
}

ToolExecutionResult execute_builtin_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    const std::string executor_target = resolve_executor_target(tool);
    const auto &registry = builtin_executor_registry();
    if (registry.contains(executor_target)) {
        return registry.at(executor_target)(tool, request);
    }

    return make_executor_error(
        "failed",
        "E_EXECUTOR_NOT_FOUND",
        "builtin executor is not registered",
        json{{"executor_target", executor_target}},
        executor_target
    );
}

ToolExecutionResult execute_native_tool(const ToolRegistration &tool, const ToolExecutionRequest &request) {
    (void)request;
    const std::string executor_target = resolve_executor_target(tool);
    return ToolExecutionResult{
        .status = "blocked",
        .result = json::object(),
        .error = json{
            {"error_code", "E_NATIVE_EXECUTOR_UNAVAILABLE"},
            {"message", "native executor is not available in this build"},
            {"detail", json{{"executor_target", executor_target}}}
        },
        .evidence = json::array({
            json{{"kind", "executor_kind"}, {"value", "native"}},
            json{{"kind", "executor_target"}, {"value", executor_target}}
        }),
        .handoff = "manual_takeover"
    };
}

ToolExecutionResult execute_tool_registration(
    const ToolRegistration &tool,
    const ToolExecutionRequest &request
) {
    switch (tool.executor_kind) {
        case ExecutorKind::Builtin:
            return execute_builtin_tool(tool, request);
        case ExecutorKind::Native:
            return execute_native_tool(tool, request);
        case ExecutorKind::Mock:
        default:
            return execute_mock_tool(tool, request);
    }
}

std::string build_idempotency_signature(const NormalizedCall &call) {
    return call.provider_kind + "|" + call.tool_name + "|" + call.input_normalized.dump();
}

bool handle_idempotency_replay_locked(
    const PolicyView &policy,
    const NormalizedCall &call,
    std::string *idempotency_key_out,
    std::string *idempotency_signature_out
) {
    *idempotency_key_out = policy.idempotency_key;
    *idempotency_signature_out = build_idempotency_signature(call);

    if (idempotency_key_out->empty() || !g_idempotency_to_execution.contains(*idempotency_key_out)) {
        return false;
    }

    if (g_idempotency_signature.contains(*idempotency_key_out) &&
        g_idempotency_signature.at(*idempotency_key_out) != *idempotency_signature_out) {
        fail_function_call(json{
            {"error_code", "E_IDEMPOTENCY_CONFLICT"},
            {"message", "idempotency_key reused with different provider/tool/arguments"},
            {"detail", json{{"idempotency_key", *idempotency_key_out}}}
        });
        return true;
    }

    const std::string exec_id = g_idempotency_to_execution.at(*idempotency_key_out);
    if (g_executions.contains(exec_id)) {
        json replay = serialize_execution_record(g_executions.at(exec_id));
        replay["handoff"] = "idempotency-hit: reuse previous execution";
        g_last_output = replay.dump();
        return true;
    }

    return false;
}

ToolExecutionRequest build_tool_execution_request(
    const ToolRegistration &tool,
    const NormalizedCall &call,
    const PolicyView &policy
) {
    return ToolExecutionRequest{
        .tool_name = call.tool_name,
        .tool_kind = tool.tool_kind,
        .provider_kind = call.provider_kind,
        .intent = call.intent,
        .provider_call_id = call.provider_call_id,
        .args = call.input_normalized,
        .policy = policy.raw_json
    };
}

ExecutionRecord build_execution_record(
    const ToolRegistration &tool,
    const NormalizedCall &call,
    const PolicyView &policy,
    const ToolExecutionResult &execution
) {
    json evidence = json::array({
        json{{"kind", "runtime_event"}, {"value", "tool_executed"}},
        json{{"kind", "provider_kind"}, {"value", call.provider_kind}},
        json{{"kind", "provider_call_id"}, {"value", call.provider_call_id}},
        json{{"kind", "timestamp"}, {"value", now_iso8601_utc()}},
        json{{"kind", "tool_kind"}, {"value", tool.tool_kind}}
    });
    append_evidence(&evidence, execution.evidence);

    return ExecutionRecord{
        .execution_id = next_id("exec"),
        .tool_kind = tool.tool_kind,
        .provider_kind = call.provider_kind,
        .intent = call.intent,
        .provider_call_id = call.provider_call_id,
        .input_raw = call.input_raw,
        .input_normalized = call.input_normalized,
        .policy_snapshot = policy.raw_json,
        .status = execution.status,
        .evidence = evidence,
        .error = execution.error,
        .handoff = execution.handoff,
        .timestamp = now_iso8601_utc(),
        .result = execution.result
    };
}

void store_execution_record_locked(
    const ExecutionRecord &record,
    const std::string &idempotency_key,
    const std::string &idempotency_signature
) {
    const std::string execution_id = record.execution_id;
    g_executions[execution_id] = record;
    if (!idempotency_key.empty()) {
        g_idempotency_to_execution[idempotency_key] = execution_id;
        g_idempotency_signature[idempotency_key] = idempotency_signature;
    }
    g_last_output = serialize_execution_record(record).dump();
}

bool execute_prepared_function_call_locked(const PolicyView &policy, const NormalizedCall &call) {
    std::string idem;
    std::string idem_signature;
    if (handle_idempotency_replay_locked(policy, call, &idem, &idem_signature)) {
        return true;
    }

    const ToolRegistration *tool = lookup_registered_tool(call.tool_name);
    if (tool == nullptr) {
        return true;
    }

    if (!validate_tool_call_request(*tool, call, policy)) {
        return true;
    }

    const ToolExecutionRequest request = build_tool_execution_request(*tool, call, policy);
    json lifecycle_evidence = json::array();
    json hook_block_error = nullptr;

    if (tool->tool_kind == "hooks" && !policy.enable_hook_recursion) {
        lifecycle_evidence.push_back(json{
            {"kind", "hook_recursion_guard"},
            {"phase", "all"},
            {"tool_name", tool->spec.name},
            {"status", "skipped"}
        });
    } else {
        const bool before_allowed = execute_hook_chain(
            policy.before_tool_hooks,
            "before_tool",
            policy,
            *tool,
            request,
            nullptr,
            &lifecycle_evidence,
            &hook_block_error
        );
        if (!before_allowed) {
            ToolExecutionResult blocked_result{
                .status = "blocked",
                .result = json::object(),
                .error = hook_block_error,
                .evidence = lifecycle_evidence,
                .handoff = "retry_or_manual_takeover"
            };
            ExecutionRecord record = build_execution_record(*tool, call, policy, blocked_result);
            store_execution_record_locked(record, idem, idem_signature);
            return true;
        }
    }

    ToolExecutionResult execution = execute_tool_registration(*tool, request);
    append_evidence(&execution.evidence, lifecycle_evidence);

    if (!(tool->tool_kind == "hooks" && !policy.enable_hook_recursion)) {
        json after_hook_error = nullptr;
        json after_hook_evidence = json::array();
        execute_hook_chain(
            policy.after_tool_hooks,
            "after_tool",
            policy,
            *tool,
            request,
            &execution,
            &after_hook_evidence,
            &after_hook_error
        );
        append_evidence(&execution.evidence, after_hook_evidence);
    }

    ExecutionRecord record = build_execution_record(*tool, call, policy, execution);
    store_execution_record_locked(record, idem, idem_signature);
    return true;
}

} // namespace better_agent::core_internal
