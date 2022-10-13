#include <stdlib.h>

__attribute__((visibility("default"))) void* _malloc(size_t size) {
  return malloc(size);
}

__attribute__((visibility("default"))) void _free(void* p) {
  return free(p);
}
