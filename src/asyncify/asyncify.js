import { WasiModule } from '../init.js'

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
  const wasiModule = new WasiModule(wasi)
  wasm = await wasiModule.load(wasmUrl, imports)
  await wasiModule.run()
} else {
  const isNodeJs = !!(typeof process === 'object' && process.versions && process.versions.node)
  
  const url = new URL('../../build/b.wasm', import.meta.url)
  const { WASI } = isNodeJs ? await import('node:wasi') : await import('../../wasi.js')
  const wasi = new WASI(wasiOptions)
  const wasiModule = new WasiModule(wasi)
  wasm = await wasiModule.load(isNodeJs ? await (await import('node:fs/promises')).readFile(url) : url, imports)
  console.log(wasm)
  await wasiModule.run()
}
