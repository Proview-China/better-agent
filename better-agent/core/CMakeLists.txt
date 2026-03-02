cmake_minimum_required(VERSION 3.25)
project(agent_core VERSION 0.1.0 LANGUAGES CXX)

# ── C++23, no compiler extensions ────────────────────────────────────────────
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ── Symbol visibility: hide by default, export only marked symbols ───────────
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

# ── macOS specifics ──────────────────────────────────────────────────────────
if(APPLE)
    set(CMAKE_OSX_ARCHITECTURES "arm64")
    set(CMAKE_MACOSX_RPATH ON)
endif()

# ── Shared library target ────────────────────────────────────────────────────
file(GLOB_RECURSE AGENT_CORE_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/cpp/*.cpp")
add_library(agent_core SHARED ${AGENT_CORE_SOURCES})

target_include_directories(agent_core
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/header>
        $<INSTALL_INTERFACE:include>
)

target_compile_definitions(agent_core PRIVATE AGENT_CORE_EXPORTS)

# ── Install rules ────────────────────────────────────────────────────────────
include(GNUInstallDirs)

install(TARGETS agent_core
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

install(DIRECTORY header/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
    FILES_MATCHING PATTERN "*.h"
)

# ── N-API addon (opt-in) ────────────────────────────────────────────────────
option(BUILD_NODE_ADDON "Build the N-API addon for Electron/Node.js" OFF)
if(BUILD_NODE_ADDON)
    add_subdirectory(bindings/node)
endif()
