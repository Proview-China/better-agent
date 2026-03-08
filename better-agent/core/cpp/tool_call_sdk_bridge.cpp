#include "tool_call_sdk_bridge.hpp"
#include "internal/core_rust_bridge.hpp"

#include <map>
#include <string>

#if defined(BETTER_AGENT_HAVE_CPP_AI_SDK)
#include "http_client.hpp"
#include "models.hpp"
#include "types.hpp"
#endif

namespace {

nlohmann::json sdk_disabled_result(const std::string &provider) {
    return nlohmann::json{
        {"provider", provider},
        {"sdk_enabled", false},
        {"error", {{"error_code", "E_SDK_DISABLED"}, {"message", "cpp-ai-sdk bridge is disabled at build time"}}}
    };
}

std::string get_string_or(const nlohmann::json &obj, const char *key, const std::string &fallback = "") {
    if (!obj.is_object() || !obj.contains(key) || !obj.at(key).is_string()) {
        return fallback;
    }
    return obj.at(key).get<std::string>();
}

#if defined(BETTER_AGENT_HAVE_CPP_AI_SDK)
nlohmann::json sdk_error_to_json(const ai_sdk::NetworkException &error) {
    return nlohmann::json{
        {"error_code", "E_SDK_NETWORK"},
        {"message", std::string(error.what())}
    };
}

nlohmann::json sdk_error_to_json(const ai_sdk::APIException &error) {
    return nlohmann::json{
        {"error_code", "E_SDK_API"},
        {"message", std::string(error.what())},
        {"status_code", error.getStatusCode()}
    };
}

nlohmann::json sdk_error_to_json(const ai_sdk::ParseException &error) {
    return nlohmann::json{
        {"error_code", "E_SDK_PARSE"},
        {"message", std::string(error.what())}
    };
}

nlohmann::json sdk_error_to_json(const ai_sdk::SDKException &error) {
    return nlohmann::json{
        {"error_code", "E_SDK_UNKNOWN"},
        {"message", std::string(error.what())}
    };
}
#endif

} // namespace

namespace better_agent {
namespace sdk_bridge {

nlohmann::json build_openai_bundle(
    const std::string &tool_name,
    const std::string &tool_description,
    const nlohmann::json &tool_parameters,
    const nlohmann::json &tool_constraints,
    const nlohmann::json &args,
    const nlohmann::json &policy,
    const std::string &provider_call_id
) {
#if !defined(BETTER_AGENT_HAVE_CPP_AI_SDK)
    (void)tool_name;
    (void)tool_description;
    (void)tool_parameters;
    (void)tool_constraints;
    (void)args;
    (void)policy;
    (void)provider_call_id;
    return sdk_disabled_result("openai");
#else
    nlohmann::json err;
    const nlohmann::json request_json = better_agent::core_internal::build_openai_request_from_execution_via_rust(
        nlohmann::json{
            {"tool_name", tool_name},
            {"tool_description", tool_description},
            {"tool_parameters", tool_parameters},
            {"tool_constraints", tool_constraints},
            {"args", args},
            {"policy", policy},
            {"provider_call_id", provider_call_id}
        },
        &err
    );
    if (!err.is_null()) {
        return nlohmann::json{
            {"provider", "openai"},
            {"sdk_enabled", true},
            {"request", request_json},
            {"error", err}
        };
    }
    return build_openai_bundle_from_request(request_json, policy);
#endif
}

nlohmann::json build_openai_bundle_from_request(
    const nlohmann::json &request_json,
    const nlohmann::json &policy
) {
#if !defined(BETTER_AGENT_HAVE_CPP_AI_SDK)
    (void)request_json;
    (void)policy;
    return sdk_disabled_result("openai");
#else
    nlohmann::json out{
        {"provider", "openai"},
        {"sdk_enabled", true},
        {"request", request_json}
    };
    if (policy.value("sdk_execute", false)) {
        try {
            const auto api_key = get_string_or(policy, "openai_api_key");
            if (api_key.empty()) {
                out["error"] = nlohmann::json{
                    {"error_code", "E_SDK_MISSING_KEY"},
                    {"message", "openai_api_key is required when sdk_execute=true"}
                };
                return out;
            }

            const std::string base_url = policy.value("openai_base_url", std::string("https://api.openai.com/v1"));
            const std::string endpoint = policy.value("openai_endpoint", std::string("/responses"));
            const std::string url = base_url + endpoint;

            ai_sdk::HttpClient client;
            const std::map<std::string, std::string> headers = {
                {"Content-Type", "application/json"},
                {"Authorization", "Bearer " + api_key}
            };
            const std::string response = client.post(url, request_json.dump(), headers);
            out["response"] = nlohmann::json::parse(response);
        } catch (const ai_sdk::APIException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const ai_sdk::ParseException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const ai_sdk::NetworkException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const ai_sdk::SDKException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const std::exception &e) {
            out["error"] = nlohmann::json{
                {"error_code", "E_SDK_UNKNOWN"},
                {"message", e.what()}
            };
        }
    }

    return out;
#endif
}

nlohmann::json build_claude_bundle(
    const std::string &tool_name,
    const std::string &tool_description,
    const nlohmann::json &tool_parameters,
    const nlohmann::json &tool_constraints,
    const nlohmann::json &args,
    const nlohmann::json &policy,
    const std::string &provider_call_id
) {
#if !defined(BETTER_AGENT_HAVE_CPP_AI_SDK)
    (void)tool_name;
    (void)tool_description;
    (void)tool_parameters;
    (void)tool_constraints;
    (void)args;
    (void)policy;
    (void)provider_call_id;
    return sdk_disabled_result("claude");
#else
    (void)tool_constraints;
    const std::vector<ai_sdk::Message> messages = {
        ai_sdk::Message{
            "user",
            policy.value("user_prompt", std::string("Please call the requested tool."))
        }
    };

    nlohmann::json messages_json = nlohmann::json::array();
    for (const auto &msg : messages) {
        messages_json.push_back({
            {"role", msg.role},
            {"content", msg.content}
        });
    }

    nlohmann::json request_json{
        {"model", policy.value("claude_model", std::string("claude-3-7-sonnet-latest"))},
        {"max_tokens", policy.value("max_tokens", 1024)},
        {"messages", messages_json},
        {"tools", nlohmann::json::array({
            nlohmann::json{
                {"name", tool_name},
                {"description", tool_description},
                {"input_schema", tool_parameters}
            }
        })},
        {"tool_choice", policy.value(
            "tool_choice",
            nlohmann::json{{"type", "tool"}, {"name", tool_name}}
        )},
        {"input", nlohmann::json{
            {"type", "tool_use"},
            {"id", provider_call_id},
            {"name", tool_name},
            {"input", args}
        }}
    };

    nlohmann::json out{
        {"provider", "claude"},
        {"sdk_enabled", true},
        {"request", request_json}
    };

    if (policy.value("sdk_execute", false)) {
        try {
            const auto api_key = get_string_or(policy, "claude_api_key");
            if (api_key.empty()) {
                out["error"] = nlohmann::json{
                    {"error_code", "E_SDK_MISSING_KEY"},
                    {"message", "claude_api_key is required when sdk_execute=true"}
                };
                return out;
            }

            const std::string base_url = policy.value("claude_base_url", std::string("https://api.anthropic.com/v1"));
            const std::string endpoint = policy.value("claude_endpoint", std::string("/messages"));
            const std::string url = base_url + endpoint;

            ai_sdk::HttpClient client;
            const std::map<std::string, std::string> headers = {
                {"Content-Type", "application/json"},
                {"x-api-key", api_key},
                {"anthropic-version", policy.value("anthropic_version", std::string("2023-06-01"))}
            };
            const std::string response = client.post(url, request_json.dump(), headers);
            out["response"] = nlohmann::json::parse(response);
        } catch (const ai_sdk::APIException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const ai_sdk::ParseException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const ai_sdk::NetworkException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const ai_sdk::SDKException &e) {
            out["error"] = sdk_error_to_json(e);
        } catch (const std::exception &e) {
            out["error"] = nlohmann::json{
                {"error_code", "E_SDK_UNKNOWN"},
                {"message", e.what()}
            };
        }
    }

    return out;
#endif
}

} // namespace sdk_bridge
} // namespace better_agent
