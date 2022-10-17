function isPromise(obj) {
  return !!(obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function')
}

const ignoreNames = [
  'asyncify_get_state',
  'asyncify_start_rewind',
  'asyncify_start_unwind',
  'asyncify_stop_rewind',
  'asyncify_stop_unwind'
]

/** @type {WeakMap<WebAssembly.Exports, WebAssembly.Exports>} */
const wrappedExports = new WeakMap()

export class Asyncify {
  constructor (dataPtr = 16) {
    this.value = undefined
    this.exports = undefined
    this.dataPtr = dataPtr
  }

  init (imports, instance, start = 24, end = 1024) {
    if (instance instanceof Instance) return
    const exports = instance.exports
    const memory = exports.memory || (imports.env && imports.env.memory)
    new Int32Array(memory.buffer, this.dataPtr).set([start, end])
    this.exports = this.wrapExports(exports)
    Object.setPrototypeOf(instance, Instance.prototype)
  }

  assertState () {
    if (this.exports.asyncify_get_state() !== 0 /* NONE */) {
      throw new Error('Asyncify state error')
    }
  }

  wrapImportFunction (f) {
    return (...args) => {
      while (this.exports.asyncify_get_state() === 2 /* REWINDING */) {
        this.exports.asyncify_stop_rewind()
        return this.value
      }
      this.assertState()
      const v = f(...args)
      if (!isPromise(v)) return v
      this.exports.asyncify_start_unwind(this.dataPtr)
      this.value = v
    }
  }

  wrapImports (imports) {
    const importObject = {}
    Object.keys(imports).forEach(k => {
      const mod = imports[k]
      const newModule = {}
      Object.keys(mod).forEach(name => {
        const importValue = mod[name]
        if (typeof importValue === 'function') {
          newModule[name] = this.wrapImportFunction(importValue)
        } else {
          newModule[name] = importValue
        }
      })
      importObject[k] = newModule
    })
    return importObject
  }

  wrapExportFunction (f) {
    return async (...args) => {
      this.assertState()
      let ret = f(...args)

      while (this.exports.asyncify_get_state() === 1 /* UNWINDING */) {
        this.exports.asyncify_stop_unwind()
        this.value = await this.value
        this.assertState()
        this.exports.asyncify_start_rewind(this.dataPtr)
        ret = f(...args)
      }

      this.assertState()
      return ret
    }
  }

  wrapExports (exports) {
    const newExports = Object.create(null)
    Object.keys(exports).forEach(name => {
      const exportValue = exports[name]
      const ignore = ignoreNames.indexOf(name) !== -1 || typeof exportValue !== 'function'
      Object.defineProperty(newExports, name, {
        enumerable: true,
        value: ignore ? exportValue : this.wrapExportFunction(exportValue)
      })
    })

    wrappedExports.set(exports, newExports)
    return newExports
  }
}

export class Instance extends WebAssembly.Instance {
  constructor (module, importObject) {
    const asyncify = new Asyncify()
    super(module, asyncify.wrapImports(importObject))
    asyncify.init(importObject, this)
  }

  get exports () {
    return wrappedExports.get(super.exports)
  }
}
Object.defineProperty(Instance.prototype, 'exports', { enumerable: true })
