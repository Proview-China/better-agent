cmake_minimum_required(VERSION 3.25)
project(agent_core VERSION 0.1.0 LANGUAGES CXX)

# -- C++23, no compiler extensions -------------------------------------------
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

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
file(GLOB_RECURSE AGENT_CORE_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/cpp/*.cpp")
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
