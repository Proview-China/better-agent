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
    agent_core_unit_runtime_normalization_contract
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/runtime_normalization_contract_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_normalization_scenarios
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/runtime_normalization_scenarios_test.cpp
)
add_agent_core_test(
    agent_core_unit_memory_store_query
    ${AGENT_CORE_TEST_ROOT}/unit/memory/memory_store_query_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_gpt_builder
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_gpt_builder_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_gpt_builder_variants
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_gpt_builder_variants_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_runtime_tools
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_runtime_tools_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_toolset
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_toolset_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_basic_abilities
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_basic_abilities_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_hooks_skills
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_hooks_skills_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_ability_preset
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_ability_preset_test.cpp
)
add_agent_core_test(
    agent_core_unit_runtime_rust_local_shell_and_payloads
    ${AGENT_CORE_TEST_ROOT}/unit/runtime/rust_local_shell_and_payloads_test.cpp
)
