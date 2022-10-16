// TODO: asyncify

export class WasiModule {
  constructor (wasi) {
    this._wasi = wasi
    this.instance = undefined
    this.module = undefined
  }

  get exports () {
    if (this.instance) {
      return this.instance.exports
    }
  }

  async load (url, imports = {}) {
    if (this.instance) {
      return this.instance.exports
    }

    const { wasi_snapshot_preview1: importWasiSnapshotPreview1, ...restImports } = imports

    const importObject = {
      wasi_snapshot_preview1: {
        ...this._wasi.wasiImport,
        ...importWasiSnapshotPreview1
      },
      ...restImports
    }

    let source
  
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      source = await WebAssembly.instantiateStreaming(fetch(url), importObject)
    } else {
      const bytes = url instanceof Uint8Array ? url : await (await fetch(url)).arrayBuffer()
      source = await WebAssembly.instantiate(bytes, importObject)
    }

    const { instance, module } = source
    console.log(instance)
    this.instance = instance
    this.module = module
    return instance.exports
  }

  run () {
    if (typeof this.instance.exports._start === 'function') {
      return this._wasi.start(this.instance)
    }
    return this._wasi.initialize(this.instance)
  }
}
