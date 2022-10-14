import init from './src/init.js'
import wrap from './src/wrap.js'
import main from './src/main.js'

let wasm

if (typeof __webpack_public_path__ !== 'undefined') {
  // webpack
  const wasmUrl = (await import('./build/a.wasm')).default
  const { WASI } = await import('./wasi.js')
  wasm = await init(wasmUrl, WASI)
} else {
  const isNodeJs = !!(typeof process === 'object' && process.versions && process.versions.node)
  
  const url = new URL('./build/a.wasm', import.meta.url)
  const { WASI } = isNodeJs ? await import('node:wasi') : await import('./wasi.js')
  wasm = await init(isNodeJs ? await (await import('node:fs/promises')).readFile(url) : url, WASI)
}

await main(wrap(wasm))
