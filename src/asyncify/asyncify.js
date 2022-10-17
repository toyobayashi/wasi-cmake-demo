import { WasmModule } from '../init.js'

let wasm

const imports = {
  env: {
    async_sleep (ms) {
      return new Promise(resolve => {
        setTimeout(resolve, ms)
      })
    }
  }
}

const wasiOptions = {
  args: ['node', 'b.wasm'],
  env: {
    NODE_ENV: 'development',
    WASI_SDK_PATH: '/tmp/wasi-sdk'
  }
}

if (typeof __webpack_public_path__ !== 'undefined') {
  // webpack
  const wasmUrl = (await import('../../build/b.wasm')).default
  const { WASI } = await import('../../wasi.js')
  const wasi = new WASI(wasiOptions)
  const wasmModule = await WasmModule.load(wasmUrl, imports, wasi)
  wasm = wasmModule.instance.exports
  await (wasmModule.run().ret)
} else {
  const isNodeJs = !!(typeof process === 'object' && process.versions && process.versions.node)
  
  const url = new URL('../../build/b.wasm', import.meta.url)
  const { WASI } = isNodeJs ? await import('node:wasi') : await import('../../wasi.js')
  const wasi = new WASI(wasiOptions)
  const wasmModule = await WasmModule.load(isNodeJs ? await (await import('node:fs/promises')).readFile(url) : url, imports, wasi)
  wasm = wasmModule.instance.exports
  await (wasmModule.run().ret)
}
