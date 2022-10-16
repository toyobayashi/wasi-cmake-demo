let wasm

export default async function (url, WASI) {
  if (wasm) {
    return wasm
  }
  const wasi = new WASI({
    args: ['node', 'a.wasm'],
    env: {
      NODE_ENV: 'development',
      WASI_SDK_PATH: '/tmp/wasi-sdk'
    }
  })

  const importObject = {
    env: {
      call_js (f) {
        wasm.__indirect_function_table.get(f)()
      }
    },
    wasi_snapshot_preview1: wasi.wasiImport
  }

  let source

  if (typeof WebAssembly.instantiateStreaming === 'function') {
    source = await WebAssembly.instantiateStreaming(fetch(url), importObject)
  } else {
    const bytes = url instanceof Uint8Array ? url : await (await fetch(url)).arrayBuffer()
    source = await WebAssembly.instantiate(bytes, importObject)
  }

  const { instance } = source

  wasm = instance.exports
  if (typeof wasm._start === 'function') {
    wasi.start(instance)
  } else {
    wasi.initialize(instance)
  }
  return wasm
}
