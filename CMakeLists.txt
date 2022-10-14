cmake_minimum_required(VERSION 3.13.0)

project(wasitest)

set(TARGET_TEST_EXE a)

add_executable(${TARGET_TEST_EXE} "src/base64.c" "src/main.c")
set_target_properties(${TARGET_TEST_EXE} PROPERTIES SUFFIX ".wasm")

target_link_options(${TARGET_TEST_EXE} PRIVATE
  "-v"
  # "-nostartfiles"
  # "-Wl,--no-entry"
  # "-Wl,--import-memory"
  "-Wl,--initial-memory=16777216,--export-dynamic,--export=malloc,--export=free,--import-undefined,--export-table"
)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
  target_link_options(${TARGET_TEST_EXE} PRIVATE
    "-Wl,--strip-all"
  )
endif()
