#include <stdio.h>

void call_js(void (*)());

void print() {
  printf("Hello");
  printf(" wasi\n");
}

int main(int argc, char** argv) {
  for (int i = 0; i < argc; ++i) {
    printf("%d: %s\n", i, *(argv + i));
  }
  call_js(print);
  return 0;
}
