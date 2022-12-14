import { Asyncify, Instance } from './asyncify.js'

/**
 * @param {string | URL | BufferSource} urlOrBuffer
 * @param {WebAssembly.Imports=} imports
 * @returns {Promise<WebAssembly.WebAssemblyInstantiatedSource>}
 */
export async function load (urlOrBuffer, imports, asyncify = false) {
  if (imports && typeof imports !== 'object') {
    throw new TypeError('imports must be an object or undefined')
  }
  imports = imports || {}

  let asyncifyHelper
  let source

  if (asyncify) {
    asyncifyHelper = new Asyncify()
    imports = asyncifyHelper.wrapImports(imports)
  }

  if (urlOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(urlOrBuffer)) {
    source = await WebAssembly.instantiate(urlOrBuffer, imports)
    if (asyncify) asyncifyHelper.init(imports, source.instance)
    return source
  }

  if (typeof urlOrBuffer !== 'string' && !(urlOrBuffer instanceof URL)) {
    throw new TypeError('Invalid source')
  }

  if (typeof WebAssembly.instantiateStreaming === 'function') {
    try {
      source = await WebAssembly.instantiateStreaming(fetch(urlOrBuffer), imports)
      if (asyncify) asyncifyHelper.init(imports, source.instance)
      return source
    } catch (_) {}
  }
  const response = await fetch(urlOrBuffer)
  const buffer = await response.arrayBuffer()
  source = await WebAssembly.instantiate(buffer, imports)
  if (asyncify) asyncifyHelper.init(imports, source.instance)
  return source
}

/**
 * @param {BufferSource} buffer
 * @param {WebAssembly.Imports=} imports
 * @returns {WebAssembly.WebAssemblyInstantiatedSource}
 */
export function loadSync (buffer, imports, asyncify = false) {
  if ((buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) {
    throw new TypeError('Invalid source')
  }

  if (imports && typeof imports !== 'object') {
    throw new TypeError('imports must be an object or undefined')
  }
  imports = imports || {}

  const module = new WebAssembly.Module(buffer)
  const instance = asyncify ? new Instance(module, imports) : new WebAssembly.Instance(module, imports)
  return { instance, module }
}

export class WasmModule {
  static async load (urlOrBuffer, imports, wasi = undefined, asyncify = false) {
    if (imports && typeof imports !== 'object') {
      throw new TypeError('imports must be an object or undefined')
    }
    imports = imports || {}

    let importObject

    if (wasi) {
      const { wasi_snapshot_preview1: importWasiSnapshotPreview1, ...restImports } = imports
      importObject = {
        wasi_snapshot_preview1: {
          ...wasi.wasiImport,
          ...importWasiSnapshotPreview1
        },
        ...restImports
      }
    } else {
      importObject = imports
    }

    const source = await load(urlOrBuffer, importObject, asyncify)
    console.log(source)

    return new WasmModule(source, wasi)
  }

  /**
   * @param {WebAssembly.WebAssemblyInstantiatedSource} source 
   * @param {import('wasi').WASI=} wasi 
   */
  constructor (source, wasi) {
    this._wasi = wasi
    this.instance = source.instance
    this.module = source.module
  }

  get exports () {
    if (this.instance) {
      return this.instance.exports
    }
  }

  /**
   * @returns {{ entry: '_start' | '_initialize' | '__main_void' | 'main' | undefined; ret: number | undefined | Promise<number | undefined> }}
   */
  run () {
    if (!this.instance) throw new Error('Invalid WASM module')

    const exports = this.instance.exports

    if (this._wasi) {
      if (typeof exports._start === 'function') {
        return {
          entry: '_start',
          ret: this._wasi.start(this.instance)
        }
      }
      return {
        entry: typeof exports._initialize === 'function' ? '_initialize' : undefined,
        ret: this._wasi.initialize(this.instance)
      }
    }

    if (typeof exports._start === 'function') {
      return { entry: '_start', ret: exports._start() }
    }
    if (typeof exports._initialize === 'function') {
      return { entry: '_initialize', ret: exports._initialize() }
    }
    if (typeof exports.__main_void === 'function') {
      return { entry: '__main_void', ret: exports.__main_void() }
    }
    if (typeof exports.main === 'function') {
      return { entry: 'main', ret: exports.main(0, 0) }
    }
    return { entry: undefined, ret: undefined }
  }
}
