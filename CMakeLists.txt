cmake_minimum_required(VERSION 3.13.0)

project(wasitest)

add_executable(base64 "src/base64.c" "src/malloc.c")
set_target_properties(base64 PROPERTIES SUFFIX ".wasm")

target_link_options(base64
  PRIVATE "-v"
  PRIVATE "-nostartfiles"
  PRIVATE "-Wl,--no-entry"
  PRIVATE "-Wl,--import-memory"
  PRIVATE "-Wl,--export-dynamic"
)
