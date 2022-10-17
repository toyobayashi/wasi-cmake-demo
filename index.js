import { WasmModule } from './src/init.js'
import wrap from './src/wrap.js'
import main from './src/main.js'

let wasm

const imports = {
  env: {
    call_js (f) {
      wasm.__indirect_function_table.get(f)()
    }
  }
}

const wasiOptions = {
  args: ['node', 'a.wasm'],
  env: {
    NODE_ENV: 'development',
    WASI_SDK_PATH: '/tmp/wasi-sdk'
  }
}

if (typeof __webpack_public_path__ !== 'undefined') {
  // webpack
  const wasmUrl = (await import('./build/a.wasm')).default
  const { WASI } = await import('./wasi.js')
  const wasi = new WASI(wasiOptions)
  const wasmModule = await WasmModule.load(wasmUrl, imports, wasi)
  wasm = wasmModule.instance.exports
  await wasmModule.run()
} else {
  const isNodeJs = !!(typeof process === 'object' && process.versions && process.versions.node)
  
  const url = new URL('./build/a.wasm', import.meta.url)
  const { WASI } = isNodeJs ? await import('node:wasi') : await import('./wasi.js')
  const wasi = new WASI(wasiOptions)
  const wasmModule = await WasmModule.load(isNodeJs ? await (await import('node:fs/promises')).readFile(url) : url, imports, wasi)
  wasm = wasmModule.instance.exports
  await wasmModule.run()
}

await main(wrap(wasm))
