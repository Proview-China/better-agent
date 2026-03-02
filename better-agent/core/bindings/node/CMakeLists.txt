cmake_minimum_required(VERSION 3.25)

# ── N-API addon target ───────────────────────────────────────────────────────
# This is designed to be invoked via cmake-js, which provides:
#   CMAKE_JS_INC  — Node/N-API include directories
#   CMAKE_JS_LIB  — (Windows only) node import library
#   CMAKE_JS_SRC  — (optional) additional sources

add_library(agent_core_napi MODULE
    agent_core_napi.cpp
)

set_target_properties(agent_core_napi PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    CXX_STANDARD 23
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
)

target_include_directories(agent_core_napi PRIVATE
    ${CMAKE_JS_INC}
)

target_link_libraries(agent_core_napi PRIVATE
    agent_core
    ${CMAKE_JS_LIB}
)
