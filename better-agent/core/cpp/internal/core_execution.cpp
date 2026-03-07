#include "agent_core_internal.hpp"

#include <cstdlib>
#include <cctype>
#include <chrono>
#include <filesystem>
#include <fcntl.h>
#include <fstream>
#include <signal.h>
#include <sstream>
#include <string>

#if defined(__APPLE__) || defined(__linux__)
    #include <poll.h>
    #include <sys/resource.h>
    #include <sys/wait.h>
    #include <unistd.h>
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

std::string detect_unsafe_shell_syntax(const std::string &command) {
    bool in_single = false;
    bool in_double = false;
    bool escaped = false;

    for (std::size_t index = 0; index < command.size(); ++index) {
        const char ch = command[index];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch == '\\' && !in_single) {
            escaped = true;
            continue;
        }
        if (ch == '\'' && !in_double) {
            in_single = !in_single;
            continue;
        }
        if (ch == '"' && !in_single) {
            in_double = !in_double;
            continue;
        }
        if (ch == '\n' || ch == '\r') {
            return "newline";
        }
        if (!in_single && ch == '`') {
            return "`";
        }
        if (!in_single && ch == '$' && index + 1 < command.size() && command[index + 1] == '(') {
            return "$(";
        }
        if (!in_single && !in_double &&
            (ch == ';' || ch == '&' || ch == '|' || ch == '<' || ch == '>')) {
            return std::string(1, ch);
        }
    }

    if (in_single || in_double || escaped) {
        return "unterminated_quote_or_escape";
    }
    return "";
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

bool is_known_network_command(const std::string &command_token) {
    return command_token == "curl" ||
        command_token == "wget" ||
        command_token == "ssh" ||
        command_token == "scp" ||
        command_token == "sftp" ||
        command_token == "nc" ||
        command_token == "telnet" ||
        command_token == "ftp" ||
        command_token == "ping";
}

bool is_truthy_bool(const json &obj, const char *key) {
    return obj.is_object() && obj.contains(key) && obj.at(key).is_boolean() && obj.at(key).get<bool>();
}

std::string truncate_bytes(const std::string &text, std::size_t max_bytes, bool *truncated_out) {
    if (truncated_out != nullptr) {
        *truncated_out = false;
    }
    if (max_bytes == 0 || text.size() <= max_bytes) {
        return text;
    }
    if (truncated_out != nullptr) {
        *truncated_out = true;
    }
    return text.substr(0, max_bytes);
}

#if defined(__APPLE__) || defined(__linux__)
void set_nonblocking_fd(int fd) {
    const int flags = fcntl(fd, F_GETFL, 0);
    if (flags >= 0) {
        (void)fcntl(fd, F_SETFL, flags | O_NONBLOCK);
    }
}
#endif

void append_limit_evidence(
    json *evidence,
    const char *kind,
    std::size_t configured_limit,
    bool truncated,
    std::size_t original_size
) {
    if (!truncated) {
        return;
    }
    evidence->push_back(json{
        {"kind", kind},
        {"configured_limit", configured_limit},
        {"original_size", original_size},
        {"status", "truncated"}
    });
}

void apply_artifact_limit(
    json *artifacts,
    std::size_t max_artifacts,
    json *result,
    json *evidence
) {
    if (!artifacts->is_array() || max_artifacts == 0 || artifacts->size() <= max_artifacts) {
        return;
    }
    const std::size_t omitted = artifacts->size() - max_artifacts;
    json trimmed = json::array();
    for (std::size_t index = 0; index < max_artifacts; ++index) {
        trimmed.push_back((*artifacts).at(index));
    }
    *artifacts = trimmed;
    (*result)["artifacts_truncated"] = true;
    (*result)["omitted_artifact_count"] = omitted;
    evidence->push_back(json{
        {"kind", "artifacts"},
        {"configured_limit", max_artifacts},
        {"omitted_count", omitted},
        {"status", "truncated"}
    });
}

bool interrupt_requested_for_execution(const std::string &execution_id) {
    std::lock_guard<std::mutex> lk(g_running_mu);
    if (!g_running_executions.contains(execution_id)) {
        return false;
    }
    return g_running_executions.at(execution_id).interrupt_requested;
}

#if defined(__APPLE__) || defined(__linux__)
void apply_posix_resource_limits_in_child(const ToolExecutionRequest &request) {
    if (request.policy.contains("cpu_limit") && request.policy.at("cpu_limit").is_number_integer()) {
#if defined(RLIMIT_CPU)
        const rlim_t cpu_limit = static_cast<rlim_t>(request.policy.at("cpu_limit").get<long long>());
        struct rlimit limit { cpu_limit, cpu_limit };
        (void)setrlimit(RLIMIT_CPU, &limit);
#endif
    }
    if (request.policy.contains("memory_limit") && request.policy.at("memory_limit").is_number_integer()) {
#if defined(RLIMIT_AS)
        const rlim_t memory_limit = static_cast<rlim_t>(request.policy.at("memory_limit").get<long long>());
        struct rlimit limit { memory_limit, memory_limit };
        (void)setrlimit(RLIMIT_AS, &limit);
#elif defined(RLIMIT_DATA)
        const rlim_t memory_limit = static_cast<rlim_t>(request.policy.at("memory_limit").get<long long>());
        struct rlimit limit { memory_limit, memory_limit };
        (void)setrlimit(RLIMIT_DATA, &limit);
#endif
    }
}
#endif

ToolExecutionResult run_process_in_temp_dir(
    const std::string &executor_target,
    const ToolExecutionRequest &request,
    const fs::path &cwd,
    const std::string &runner_command,
    const json &result_metadata,
    const json &extra_artifacts
) {
    const fs::path temp_dir = fs::temp_directory_path() / next_id("agent-core");
    fs::create_directories(temp_dir);

    const fs::path stdout_path = temp_dir / "stdout.txt";
    const fs::path stderr_path = temp_dir / "stderr.txt";

    json evidence = json::array({
        json{{"kind", "executor_kind"}, {"value", "builtin"}},
        json{{"kind", "executor_target"}, {"value", executor_target}},
        json{{"kind", "cwd"}, {"value", cwd.string()}},
        json{{"kind", "artifact_dir"}, {"value", temp_dir.string()}},
        json{{"kind", "execution_id"}, {"value", request.execution_id}}
    });

    json result = result_metadata;
    result["cwd"] = cwd.string();
    result["sandbox"] = json{
        {"timeout_ms", request.policy.value("timeout_ms", 0)},
        {"network_access", request.policy.value("network_access", false)},
        {"cpu_limit", request.policy.value("cpu_limit", nullptr)},
        {"memory_limit", request.policy.value("memory_limit", nullptr)},
        {"unsupported_limits", json::array()},
        {"interrupted", false},
        {"timed_out", false}
    };

    if (!request.policy.value("cpu_limit", json(nullptr)).is_null()) {
#if !defined(RLIMIT_CPU)
        result["sandbox"]["unsupported_limits"].push_back("cpu_limit");
        evidence.push_back(json{{"kind", "cpu_limit"}, {"status", "unsupported"}});
#else
        evidence.push_back(json{{"kind", "cpu_limit"}, {"status", "requested"}, {"value", request.policy.at("cpu_limit")}});
#endif
    }
    if (!request.policy.value("memory_limit", json(nullptr)).is_null()) {
#if !defined(RLIMIT_AS) && !defined(RLIMIT_DATA)
        result["sandbox"]["unsupported_limits"].push_back("memory_limit");
        evidence.push_back(json{{"kind", "memory_limit"}, {"status", "unsupported"}});
#else
        evidence.push_back(json{{"kind", "memory_limit"}, {"status", "requested"}, {"value", request.policy.at("memory_limit")}});
#endif
    }

#if !defined(__APPLE__) && !defined(__linux__)
    return make_executor_error(
        "blocked",
        "E_PLATFORM_UNSUPPORTED",
        "POSIX sandbox execution requires macOS or Linux",
        json{{"platform", current_platform_name(request.policy)}},
        executor_target
    );
#else
    int stdout_pipe[2] = {-1, -1};
    int stderr_pipe[2] = {-1, -1};
    if (pipe(stdout_pipe) != 0 || pipe(stderr_pipe) != 0) {
        return make_executor_error(
            "failed",
            "E_SANDBOX_PIPE",
            "failed to create sandbox pipes",
            json::object(),
            executor_target
        );
    }

    const pid_t pid = fork();
    if (pid < 0) {
        close(stdout_pipe[0]);
        close(stdout_pipe[1]);
        close(stderr_pipe[0]);
        close(stderr_pipe[1]);
        return make_executor_error(
            "failed",
            "E_SANDBOX_FORK",
            "failed to fork sandbox process",
            json::object(),
            executor_target
        );
    }

    if (pid == 0) {
        setpgid(0, 0);
        dup2(stdout_pipe[1], STDOUT_FILENO);
        dup2(stderr_pipe[1], STDERR_FILENO);
        close(stdout_pipe[0]);
        close(stdout_pipe[1]);
        close(stderr_pipe[0]);
        close(stderr_pipe[1]);
        (void)chdir(cwd.c_str());
        apply_posix_resource_limits_in_child(request);
        execl("/bin/sh", "sh", "-c", runner_command.c_str(), static_cast<char *>(nullptr));
        _exit(127);
    }

    close(stdout_pipe[1]);
    close(stderr_pipe[1]);
    set_nonblocking_fd(stdout_pipe[0]);
    set_nonblocking_fd(stderr_pipe[0]);

    {
        std::lock_guard<std::mutex> lk(g_running_mu);
        g_running_executions[request.execution_id] = RunningExecution{
            .execution_id = request.execution_id,
            .tool_name = request.tool_name,
            .tool_kind = request.tool_kind,
            .policy_snapshot = request.policy,
            .pid = static_cast<int>(pid),
            .interrupt_requested = false
        };
    }

    std::string stdout_buffer;
    std::string stderr_buffer;
    bool stdout_closed = false;
    bool stderr_closed = false;
    bool timed_out = false;
    bool interrupted = false;
    int child_status = 0;
    bool child_exited = false;
    const auto started_at = std::chrono::steady_clock::now();

    while (!(child_exited && stdout_closed && stderr_closed)) {
        struct pollfd fds[2];
        std::size_t nfds = 0;
        if (!stdout_closed) {
            fds[nfds++] = pollfd{stdout_pipe[0], POLLIN | POLLHUP, 0};
        }
        if (!stderr_closed) {
            fds[nfds++] = pollfd{stderr_pipe[0], POLLIN | POLLHUP, 0};
        }

        const int timeout = 50;
        (void)poll(fds, static_cast<nfds_t>(nfds), timeout);

        auto read_fd = [](int fd, std::string *target, bool *closed) {
            char buffer[4096];
            while (true) {
                const ssize_t read_count = read(fd, buffer, sizeof(buffer));
                if (read_count > 0) {
                    target->append(buffer, static_cast<std::size_t>(read_count));
                    continue;
                }
                if (read_count == 0) {
                    *closed = true;
                }
                break;
            }
        };

        if (!stdout_closed) {
            read_fd(stdout_pipe[0], &stdout_buffer, &stdout_closed);
        }
        if (!stderr_closed) {
            read_fd(stderr_pipe[0], &stderr_buffer, &stderr_closed);
        }

        if (!child_exited) {
            const pid_t wait_result = waitpid(pid, &child_status, WNOHANG);
            if (wait_result == pid) {
                child_exited = true;
            }
        }

        if (!timed_out && request.policy.value("timeout_ms", 0ULL) > 0) {
            const auto elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - started_at
            ).count();
            if (elapsed_ms > static_cast<long long>(request.policy.value("timeout_ms", 0ULL))) {
                timed_out = true;
                killpg(pid, SIGKILL);
            }
        }
        if (!interrupted && interrupt_requested_for_execution(request.execution_id)) {
            interrupted = true;
            killpg(pid, SIGKILL);
        }
    }

    close(stdout_pipe[0]);
    close(stderr_pipe[0]);

    if (!child_exited) {
        (void)waitpid(pid, &child_status, 0);
    }

    {
        std::lock_guard<std::mutex> lk(g_running_mu);
        g_running_executions.erase(request.execution_id);
    }

    std::ofstream stdout_out(stdout_path);
    stdout_out << stdout_buffer;
    std::ofstream stderr_out(stderr_path);
    stderr_out << stderr_buffer;

    int exit_code = 0;
    if (WIFEXITED(child_status)) {
        exit_code = WEXITSTATUS(child_status);
    } else if (WIFSIGNALED(child_status)) {
        exit_code = 128 + WTERMSIG(child_status);
    }

    bool stdout_truncated = false;
    bool stderr_truncated = false;
    result["stdout"] = truncate_bytes(stdout_buffer, request.policy.value("max_stdout_bytes", static_cast<std::size_t>(0)), &stdout_truncated);
    result["stderr"] = truncate_bytes(stderr_buffer, request.policy.value("max_stderr_bytes", static_cast<std::size_t>(0)), &stderr_truncated);
    result["stdout_truncated"] = stdout_truncated;
    result["stderr_truncated"] = stderr_truncated;
    result["exit_code"] = exit_code;
    result["sandbox"]["timed_out"] = timed_out;
    result["sandbox"]["interrupted"] = interrupted;

    json artifacts = json::array({
        json{{"path", stdout_path.string()}, {"kind", "stdout"}},
        json{{"path", stderr_path.string()}, {"kind", "stderr"}}
    });
    if (extra_artifacts.is_array()) {
        for (const auto &item : extra_artifacts) {
            artifacts.push_back(item);
        }
    }
    apply_artifact_limit(&artifacts, request.policy.value("max_artifacts", static_cast<std::size_t>(0)), &result, &evidence);
    result["artifacts"] = artifacts;

    append_limit_evidence(&evidence, "stdout", request.policy.value("max_stdout_bytes", static_cast<std::size_t>(0)), stdout_truncated, stdout_buffer.size());
    append_limit_evidence(&evidence, "stderr", request.policy.value("max_stderr_bytes", static_cast<std::size_t>(0)), stderr_truncated, stderr_buffer.size());

    std::string status = "success";
    json error = nullptr;
    if (interrupted) {
        status = "interrupted";
        error = make_error_json("E_SANDBOX_INTERRUPTED", "sandbox execution was interrupted", json{{"execution_id", request.execution_id}});
        evidence.push_back(json{{"kind", "interrupt"}, {"status", "requested"}});
    } else if (timed_out) {
        status = "timeout";
        error = make_error_json("E_SANDBOX_TIMEOUT", "sandbox execution timed out", json{{"timeout_ms", request.policy.value("timeout_ms", 0ULL)}});
        evidence.push_back(json{{"kind", "timeout_ms"}, {"value", request.policy.value("timeout_ms", 0ULL)}});
    } else if (exit_code != 0) {
        status = "failed";
        error = make_error_json("E_EXECUTION_FAILED", "executor returned non-zero exit code", json{{"exit_code", exit_code}});
    }

    return make_execution_result(status, result, error, evidence, default_handoff(status));
#endif
}

ToolExecutionResult run_process_in_temp_dir(
    const std::string &executor_target,
    const fs::path &cwd,
    const std::string &runner_command,
    const json &result_metadata
) {
    (void)executor_target;
    (void)cwd;
    (void)runner_command;
    (void)result_metadata;
    return make_executor_error(
        "failed",
        "E_SANDBOX_INTERNAL",
        "deprecated overload should not be used",
        json::object(),
        "deprecated"
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
    const std::string unsafe_syntax = detect_unsafe_shell_syntax(command);
    if (!unsafe_syntax.empty()) {
        return make_executor_error(
            "blocked",
            "E_SHELL_UNSAFE_SYNTAX",
            "shell command contains unsafe control syntax",
            json{{"token", unsafe_syntax}},
            executor_target,
            "retry_or_manual_takeover"
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
    const bool requires_network = request.policy.value("requires_network", false) ||
        is_truthy_bool(request.args, "requires_network") ||
        is_known_network_command(command_token);
    if (requires_network && !request.policy.value("network_access", false)) {
        return make_executor_error(
            "blocked",
            "E_SANDBOX_NETWORK_DISABLED",
            "network access is disabled by sandbox policy",
            json{{"command", command_token}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }
    if (requires_network && request.policy.value("network_access", false)) {
        return make_executor_error(
            "blocked",
            "E_SANDBOX_NETWORK_UNSUPPORTED",
            "network-enabled sandbox is not supported in this build",
            json{{"command", command_token}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }
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
    script << command << "\n";
    script.close();

    json result_metadata{
        {"command", command},
        {"shell", shell_runner}
    };
    ToolExecutionResult execution = run_process_in_temp_dir(
        executor_target,
        request,
        cwd,
        quote_for_shell(shell_runner) + " " + quote_for_shell(script_path.string()),
        result_metadata,
        json::array({
            json{{"path", script_path.string()}, {"kind", "script"}}
        })
    );
    execution.evidence.push_back(json{{"kind", "shell"}, {"value", shell_runner}});
    if (requires_network) {
        execution.evidence.push_back(json{{"kind", "network_requirement"}, {"value", "requested"}});
    }
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
    const bool requires_network = request.policy.value("requires_network", false) ||
        is_truthy_bool(request.args, "requires_network");
    if (requires_network && !request.policy.value("network_access", false)) {
        return make_executor_error(
            "blocked",
            "E_SANDBOX_NETWORK_DISABLED",
            "network access is disabled by sandbox policy",
            json{{"runtime", runtime}},
            executor_target,
            "retry_or_manual_takeover"
        );
    }
    if (requires_network && request.policy.value("network_access", false)) {
        return make_executor_error(
            "blocked",
            "E_SANDBOX_NETWORK_UNSUPPORTED",
            "network-enabled sandbox is not supported in this build",
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
        request,
        cwd,
        command,
        json{{"runtime", runtime}},
        json::array({
            json{{"path", source_path.string()}, {"kind", "source"}}
        })
    );
    execution.evidence.push_back(json{{"kind", "runtime"}, {"value", runtime}});
    if (requires_network) {
        execution.evidence.push_back(json{{"kind", "network_requirement"}, {"value", "requested"}});
    }
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
        ToolRegistration hook_tool;
        {
            std::lock_guard<std::mutex> lk(g_tools_mu);
            if (!g_tools.contains(hook_name)) {
                hook_tool = ToolRegistration{};
            } else {
                hook_tool = g_tools.at(hook_name);
            }
        }
        if (hook_tool.spec.name.empty()) {
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

        if (hook_tool.tool_kind != "hooks") {
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
            .execution_id = target_request.execution_id + ":hook:" + phase + ":" + hook_name,
            .tool_name = hook_tool.spec.name,
            .tool_kind = hook_tool.tool_kind,
            .provider_kind = target_request.provider_kind,
            .intent = "hook." + phase,
            .provider_call_id = target_request.provider_call_id,
            .args = build_hook_payload(phase, target_tool, target_request, target_result),
            .policy = policy.raw_json
        };
        const ToolExecutionResult hook_execution = execute_tool_registration(hook_tool, hook_request);
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
    const PolicyView &policy,
    const std::string &execution_id
) {
    return ToolExecutionRequest{
        .execution_id = execution_id,
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
    const std::string &execution_id,
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
        .execution_id = execution_id,
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
    {
        std::lock_guard<std::mutex> lk(g_tools_mu);
        if (handle_idempotency_replay_locked(policy, call, &idem, &idem_signature)) {
            return true;
        }
    }

    ToolRegistration tool;
    {
        std::lock_guard<std::mutex> lk(g_tools_mu);
        if (!g_tools.contains(call.tool_name)) {
            fail_function_call(json{
                {"error_code", "E_TOOL_NOT_FOUND"},
                {"message", "tool is not registered"},
                {"detail", json{{"tool", call.tool_name}}}
            }, "failed", call.tool_name);
            return true;
        }
        tool = g_tools.at(call.tool_name);
    }

    if (!validate_tool_call_request(tool, call, policy)) {
        return true;
    }

    std::string execution_id = policy.execution_id.empty() ? next_id("exec") : policy.execution_id;
    {
        std::lock_guard<std::mutex> lk(g_tools_mu);
        if (g_executions.contains(execution_id)) {
            fail_function_call(json{
                {"error_code", "E_EXECUTION_ID_CONFLICT"},
                {"message", "execution_id already exists"},
                {"detail", json{{"execution_id", execution_id}}}
            });
            return true;
        }
    }
    {
        std::lock_guard<std::mutex> lk(g_running_mu);
        if (g_running_executions.contains(execution_id)) {
            fail_function_call(json{
                {"error_code", "E_EXECUTION_ID_CONFLICT"},
                {"message", "execution_id is already running"},
                {"detail", json{{"execution_id", execution_id}}}
            });
            return true;
        }
    }

    const ToolExecutionRequest request = build_tool_execution_request(tool, call, policy, execution_id);
    json lifecycle_evidence = json::array();
    json hook_block_error = nullptr;

    if (tool.tool_kind == "hooks" && !policy.enable_hook_recursion) {
        lifecycle_evidence.push_back(json{
            {"kind", "hook_recursion_guard"},
            {"phase", "all"},
            {"tool_name", tool.spec.name},
            {"status", "skipped"}
        });
    } else {
        const bool before_allowed = execute_hook_chain(
            policy.before_tool_hooks,
            "before_tool",
            policy,
            tool,
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
            ExecutionRecord record = build_execution_record(tool, call, policy, execution_id, blocked_result);
            std::lock_guard<std::mutex> lk(g_tools_mu);
            store_execution_record_locked(record, idem, idem_signature);
            return true;
        }
    }

    ToolExecutionResult execution = execute_tool_registration(tool, request);
    append_evidence(&execution.evidence, lifecycle_evidence);

    if (!(tool.tool_kind == "hooks" && !policy.enable_hook_recursion)) {
        json after_hook_error = nullptr;
        json after_hook_evidence = json::array();
        execute_hook_chain(
            policy.after_tool_hooks,
            "after_tool",
            policy,
            tool,
            request,
            &execution,
            &after_hook_evidence,
            &after_hook_error
        );
        append_evidence(&execution.evidence, after_hook_evidence);
    }

    ExecutionRecord record = build_execution_record(tool, call, policy, execution_id, execution);
    {
        std::lock_guard<std::mutex> lk(g_tools_mu);
        store_execution_record_locked(record, idem, idem_signature);
    }
    return true;
}

json interrupt_execution(const std::string &execution_id, json *err_out) {
    if (err_out != nullptr) {
        *err_out = nullptr;
    }
    if (execution_id.empty()) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_INPUT", "execution_id is empty");
        }
        return json::object();
    }

    std::lock_guard<std::mutex> lk(g_running_mu);
    if (!g_running_executions.contains(execution_id)) {
        if (err_out != nullptr) {
            *err_out = make_error_json(
                "E_NOT_FOUND",
                "running execution not found",
                json{{"execution_id", execution_id}}
            );
        }
        return json::object();
    }

    RunningExecution &running = g_running_executions.at(execution_id);
    running.interrupt_requested = true;
#if defined(__APPLE__) || defined(__linux__)
    if (running.pid > 0) {
        (void)killpg(running.pid, SIGKILL);
    }
#endif
    return json{
        {"status", "success"},
        {"execution_id", execution_id},
        {"tool_name", running.tool_name},
        {"tool_kind", running.tool_kind}
    };
}

} // namespace better_agent::core_internal
