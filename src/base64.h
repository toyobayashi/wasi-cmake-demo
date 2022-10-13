#ifndef SRC_BASE64_H_
#define SRC_BASE64_H_

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

__attribute__((visibility("default"))) size_t base64_encode(const unsigned char* src, size_t len, char* dst);
__attribute__((visibility("default"))) size_t base64_decode(const char* src, size_t len, unsigned char* dst);

#ifdef __cplusplus
}
#endif

#endif  // SRC_BASE64_H_
