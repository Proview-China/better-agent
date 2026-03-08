cmake_minimum_required(VERSION 3.25)
project(agent_core VERSION 0.1.0 LANGUAGES CXX)

# -- C++23, no compiler extensions -------------------------------------------
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(BUILD_RUST_RUNTIME "Build the GPT-first Rust infra runtime" ON)

set(AGENT_CORE_RUST_LIB "")
if(BUILD_RUST_RUNTIME)
    find_program(CARGO_EXECUTABLE cargo)
    if(CARGO_EXECUTABLE)
        if(CMAKE_BUILD_TYPE STREQUAL "Debug")
            set(AGENT_CORE_RUST_PROFILE "dev")
            set(AGENT_CORE_RUST_DIR_SUFFIX "debug")
        else()
            set(AGENT_CORE_RUST_PROFILE "release")
            set(AGENT_CORE_RUST_DIR_SUFFIX "release")
        endif()

        set(AGENT_CORE_RUST_MANIFEST ${CMAKE_CURRENT_SOURCE_DIR}/rust/Cargo.toml)
        set(AGENT_CORE_RUST_TARGET_DIR ${CMAKE_CURRENT_SOURCE_DIR}/rust/target)
        set(AGENT_CORE_RUST_LIB ${AGENT_CORE_RUST_TARGET_DIR}/${AGENT_CORE_RUST_DIR_SUFFIX}/libbetter_agent_core_rust.a)

        file(GLOB_RECURSE AGENT_CORE_RUST_SOURCES CONFIGURE_DEPENDS
            "${CMAKE_CURRENT_SOURCE_DIR}/rust/src/*.rs"
            "${CMAKE_CURRENT_SOURCE_DIR}/rust/Cargo.toml"
        )

        add_custom_command(
            OUTPUT ${AGENT_CORE_RUST_LIB}
            COMMAND ${CARGO_EXECUTABLE} build --manifest-path ${AGENT_CORE_RUST_MANIFEST} --lib --profile ${AGENT_CORE_RUST_PROFILE}
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/rust
            DEPENDS ${AGENT_CORE_RUST_SOURCES}
            COMMENT "Building better_agent_core_rust (${AGENT_CORE_RUST_PROFILE})"
            VERBATIM
        )

        add_custom_target(agent_core_rust_build DEPENDS ${AGENT_CORE_RUST_LIB})
        add_library(agent_core_rust STATIC IMPORTED GLOBAL)
        set_target_properties(agent_core_rust PROPERTIES IMPORTED_LOCATION ${AGENT_CORE_RUST_LIB})
        add_dependencies(agent_core_rust agent_core_rust_build)
    else()
        message(WARNING "BUILD_RUST_RUNTIME=ON but cargo was not found; Rust runtime will be skipped.")
    endif()
endif()

# -- Symbol visibility: hide by default, export only marked symbols ----------
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

# -- macOS specifics ----------------------------------------------------------
if(APPLE)
    set(CMAKE_OSX_ARCHITECTURES "arm64")
    set(CMAKE_MACOSX_RPATH ON)
endif()

# -- Optional external SDK bridge --------------------------------------------
option(AGENT_CORE_USE_CPP_AI_SDK "Link optional cpp-ai-sdk bridge" OFF)
set(AGENT_CORE_OPTIONAL_LIBS "")
set(AGENT_CORE_OPTIONAL_INCLUDES "")

if(AGENT_CORE_USE_CPP_AI_SDK)
    if(WIN32)
        set(CURL_USE_STATIC_LIBS ON)
    endif()
    find_package(CURL REQUIRED)

    if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/third-party/cpp-ai-sdk/CMakeLists.txt")
        message(FATAL_ERROR "AGENT_CORE_USE_CPP_AI_SDK=ON but third-party/cpp-ai-sdk is missing. Initialize submodules first.")
    endif()

    add_subdirectory(third-party/cpp-ai-sdk)
    list(APPEND AGENT_CORE_OPTIONAL_LIBS CURL::libcurl ai_sdk)
    list(APPEND AGENT_CORE_OPTIONAL_INCLUDES ${CMAKE_CURRENT_SOURCE_DIR}/third-party/cpp-ai-sdk/code/header)
endif()

# -- Shared library target ----------------------------------------------------
file(GLOB_RECURSE AGENT_CORE_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/cpp/*.cpp")
add_library(agent_core SHARED ${AGENT_CORE_SOURCES})

target_include_directories(agent_core
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/header>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/third-party
        ${AGENT_CORE_OPTIONAL_INCLUDES}
)

target_compile_definitions(agent_core PRIVATE AGENT_CORE_EXPORTS)
if(AGENT_CORE_USE_CPP_AI_SDK)
    target_compile_definitions(agent_core PRIVATE BETTER_AGENT_HAVE_CPP_AI_SDK=1)
endif()
if(AGENT_CORE_OPTIONAL_LIBS)
    target_link_libraries(agent_core PRIVATE ${AGENT_CORE_OPTIONAL_LIBS})
endif()
if(TARGET agent_core_rust)
    find_package(Threads REQUIRED)
    target_link_libraries(agent_core PRIVATE agent_core_rust Threads::Threads ${CMAKE_DL_LIBS})
endif()

# -- Install rules ------------------------------------------------------------
include(GNUInstallDirs)

install(TARGETS agent_core
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

install(DIRECTORY header/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
    FILES_MATCHING PATTERN "*.h"
)

# -- Tests -------------------------------------------------------------------
include(CTest)
if(BUILD_TESTING)
    add_subdirectory(tests)
endif()

# -- N-API addon (opt-in) ----------------------------------------------------
option(BUILD_NODE_ADDON "Build the N-API addon for Electron/Node.js" OFF)
if(BUILD_NODE_ADDON)
    add_subdirectory(bindings/node)
endif()
