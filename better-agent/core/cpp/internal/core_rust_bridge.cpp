#include "core_rust_bridge.hpp"
#include "agent_core_internal.hpp"

extern "C" {
const char *better_agent_rs_version();
const char *better_agent_rs_last_error();
const char *better_agent_rs_build_gpt_responses_request(const char *request_json);
const char *better_agent_rs_build_gpt_toolset(const char *request_json);
const char *better_agent_rs_build_gpt_basic_abilities(const char *request_json);
const char *better_agent_rs_build_after_tool_use_hook_payload(const char *request_json);
const char *better_agent_rs_render_skills_section(const char *request_json);
const char *better_agent_rs_build_openai_function_call_output_payload(const char *request_json);
const char *better_agent_rs_build_openai_bridge_outputs(const char *request_json);
const char *better_agent_rs_build_claude_tool_result_payload(const char *request_json);
const char *better_agent_rs_build_provider_execution_wrapper(const char *request_json);
const char *better_agent_rs_build_openai_request_from_execution(const char *request_json);
}

namespace better_agent::core_internal {

std::string rust_runtime_version() {
    const char *version = better_agent_rs_version();
    return version == nullptr ? std::string{} : std::string(version);
}

json build_gpt_responses_request_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_gpt_responses_request(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json(
                "E_RUST_RUNTIME",
                "rust runtime returned null output"
            );
        }
        return json();
    }

    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json(
                        "E_RUST_RUNTIME_PARSE",
                        "failed to parse rust runtime error"
                    );
                }
            } else {
                *err_out = make_error_json(
                    "E_RUST_RUNTIME_PARSE",
                    "failed to parse rust runtime output"
                );
            }
        }
        return json();
    }
}

json build_gpt_toolset_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_gpt_toolset(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json(
                "E_RUST_RUNTIME",
                "rust runtime returned null output"
            );
        }
        return json();
    }

    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json(
                        "E_RUST_RUNTIME_PARSE",
                        "failed to parse rust runtime error"
                    );
                }
            } else {
                *err_out = make_error_json(
                    "E_RUST_RUNTIME_PARSE",
                    "failed to parse rust runtime output"
                );
            }
        }
        return json();
    }
}

json build_gpt_basic_abilities_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_gpt_basic_abilities(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json(
                "E_RUST_RUNTIME",
                "rust runtime returned null output"
            );
        }
        return json();
    }

    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json(
                        "E_RUST_RUNTIME_PARSE",
                        "failed to parse rust runtime error"
                    );
                }
            } else {
                *err_out = make_error_json(
                    "E_RUST_RUNTIME_PARSE",
                    "failed to parse rust runtime output"
                );
            }
        }
        return json();
    }
}

json build_after_tool_use_hook_payload_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_after_tool_use_hook_payload(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_RUST_RUNTIME", "rust runtime returned null output");
        }
        return json();
    }
    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime error");
                }
            } else {
                *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime output");
            }
        }
        return json();
    }
}

json render_skills_section_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_render_skills_section(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_RUST_RUNTIME", "rust runtime returned null output");
        }
        return json();
    }
    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime error");
                }
            } else {
                *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime output");
            }
        }
        return json();
    }
}

json build_openai_function_call_output_payload_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_openai_function_call_output_payload(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_RUST_RUNTIME", "rust runtime returned null output");
        }
        return json();
    }
    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime error");
                }
            } else {
                *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime output");
            }
        }
        return json();
    }
}

json build_openai_bridge_outputs_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_openai_bridge_outputs(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_RUST_RUNTIME", "rust runtime returned null output");
        }
        return json();
    }
    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime error");
                }
            } else {
                *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime output");
            }
        }
        return json();
    }
}

json build_claude_tool_result_payload_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_claude_tool_result_payload(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_RUST_RUNTIME", "rust runtime returned null output");
        }
        return json();
    }
    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime error");
                }
            } else {
                *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime output");
            }
        }
        return json();
    }
}

json build_provider_execution_wrapper_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_provider_execution_wrapper(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json("E_RUST_RUNTIME", "rust runtime returned null output");
        }
        return json();
    }
    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime error");
                }
            } else {
                *err_out = make_error_json("E_RUST_RUNTIME_PARSE", "failed to parse rust runtime output");
            }
        }
        return json();
    }
}

json build_openai_request_from_execution_via_rust(const json &request_json, json *err_out) {
    const std::string request_text = request_json.dump();
    const char *output = better_agent_rs_build_openai_request_from_execution(request_text.c_str());
    if (output == nullptr) {
        if (err_out != nullptr) {
            *err_out = make_error_json(
                "E_RUST_RUNTIME",
                "rust runtime returned null output"
            );
        }
        return json();
    }

    try {
        return json::parse(output);
    } catch (const std::exception &) {
        const char *rust_error = better_agent_rs_last_error();
        if (err_out != nullptr) {
            if (rust_error != nullptr && rust_error[0] != '\0') {
                try {
                    *err_out = json::parse(rust_error);
                } catch (const std::exception &) {
                    *err_out = make_error_json(
                        "E_RUST_RUNTIME_PARSE",
                        "failed to parse rust runtime error"
                    );
                }
            } else {
                *err_out = make_error_json(
                    "E_RUST_RUNTIME_PARSE",
                    "failed to parse rust runtime output"
                );
            }
        }
        return json();
    }
}

} // namespace better_agent::core_internal
