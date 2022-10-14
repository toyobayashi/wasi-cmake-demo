import { WASI } from '../wasi.js'
import wasmUrl from '../build/a.wasm'

const wasi = new WASI({
  args: ['node', 'a.wasm'],
  env: {
    NODE_ENV: 'development',
    WASI_SDK_PATH: '/tmp/wasi-sdk'
  }
})

const env = {
  call_js (f) {
    __indirect_function_table.get(f)()
  }
}
const wasi_snapshot_preview1 = wasi.wasiImport

const bytes = await (await fetch(wasmUrl)).arrayBuffer()
const { instance, module } = await WebAssembly.instantiate(bytes, {
  env,
  wasi_snapshot_preview1
})

const {
  memory,
  malloc,
  free,
  base64_encode,
  base64_decode,
  __indirect_function_table
} = instance.exports

function getMemory() {
  return {
    HEAPU8: new Uint8Array(memory.buffer),
    HEAPU16: new Uint16Array(memory.buffer),
    HEAP32: new Int32Array(memory.buffer),
    HEAPU32: new Uint32Array(memory.buffer)
  }
}

wasi.start(instance)

export function b64Encode (data) {
  let buffer
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data)
  } else if (ArrayBuffer.isView(data)) {
    buffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  } else {
    throw new TypeError('Invalid data')
  }

  const buf = malloc(buffer.length)
  if (buf === 0) throw new Error('malloc failed')
  const { HEAPU8, HEAPU32 } = getMemory()
  HEAPU8.set(buffer, buf)
  let size = base64_encode(buf, buffer.length, 0)
  if (size === 0) {
    free(buf)
    throw new Error('encode failed')
  }
  const res = malloc(size)
  if (res === 0) {
    free(buf)
    throw new Error('malloc failed')
  }
  size = base64_encode(buf, buffer.length, res)
  free(buf)
  const str = new TextDecoder().decode(HEAPU8.subarray(res, res + size))
  free(res)
  return str
}

export function b64Decode (str) {
  const buffer = new TextEncoder().encode(str)
  const buf = malloc(buffer.length)
  if (buf === 0) throw new Error('malloc failed')
  const { HEAPU8 } = getMemory()
  HEAPU8.set(buffer, buf)
  let size = base64_decode(buf, buffer.length, 0)
  if (size === 0) {
    free(buf)
    throw new Error('decode failed')
  }
  const res = malloc(size)
  if (res === 0) {
    free(buf)
    throw new Error('malloc failed')
  }
  size = base64_decode(buf, buffer.length, res)
  free(buf)
  const arr = HEAPU8.slice(res, res + size)
  free(res)
  return arr
}
