set(AGENT_CORE_TEST_ROOT ${CMAKE_CURRENT_SOURCE_DIR})

function(add_agent_core_test test_name source_path)
    add_executable(${test_name} ${source_path})
    target_include_directories(${test_name} PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/common
        ${PROJECT_SOURCE_DIR}/header
        ${PROJECT_SOURCE_DIR}/third-party
    )
    target_link_libraries(${test_name} PRIVATE agent_core)
    add_test(NAME ${test_name} COMMAND ${test_name})
endfunction()

add_agent_core_test(
    agent_core_unit_runtime_tool_registry
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/tool_registry_and_custom_calls_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_policy_idempotency
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/policy_and_idempotency_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_normalization_contract
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/runtime_normalization_contract_test.cpp
)
add_agent_core_test(
    agent_core_unit_provider_payload
    ${AGENT_CORE_TEST_ROOT}/unit/provider/provider_payload_builders_test.cpp
)

if(AGENT_CORE_USE_CPP_AI_SDK)
    add_agent_core_test(
        agent_core_integration_sdk_tool_calls
        ${AGENT_CORE_TEST_ROOT}/integration/sdk/sdk_tool_call_methods_test.cpp
    )
    add_agent_core_test(
        agent_core_integration_sdk_custom_tools
        ${AGENT_CORE_TEST_ROOT}/integration/sdk/sdk_custom_tool_methods_test.cpp
    )
endif()
