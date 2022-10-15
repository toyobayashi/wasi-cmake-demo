import { WASI as _WASI } from './wasi-impl.js'

function validateObject (value, name) {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`${name} must be an object. Received ${value === null ? 'null' : typeof value}`)
  }
}

function validateArray (value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array. Received ${value === null ? 'null' : typeof value}`)
  }
}

function validateBoolean (value, name) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${name} must be a boolean. Received ${value === null ? 'null' : typeof value}`)
  }
}

function validateFunction (value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be a function. Received ${value === null ? 'null' : typeof value}`)
  }
}

function validateUndefined (value, name) {
  if (value !== undefined) {
    throw new TypeError(`${name} must be undefined. Received ${value === null ? 'null' : typeof value}`)
  }
}

function validateInt32 (value, name, min = -2147483648, max = 2147483647) {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number. Received ${value === null ? 'null' : typeof value}`)
  }
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be a integer.`)
  }
  if (value < min || value > max) {
    throw new RangeError(`${name} must be >= ${min} && <= ${max}. Received ${value}`)
  }
}

const kEmptyObject = Object.freeze(Object.create(null))
const kExitCode = Symbol('kExitCode')
const kSetMemory = Symbol('kSetMemory')
const kStarted = Symbol('kStarted')
const kInstance = Symbol('kInstance')

function setupInstance (self, instance) {
  validateObject(instance, 'instance')
  validateObject(instance.exports, 'instance.exports')

  self[kInstance] = instance
  self[kSetMemory](instance.exports.memory)
}

export class WASI {
  constructor (options = kEmptyObject) {
    validateObject(options, 'options')

    if (options.args !== undefined)
      validateArray(options.args, 'options.args')
    const args = (options.args || []).map(String)

    const env = []
    if (options.env !== undefined) {
      validateObject(options.env, 'options.env')
      Object.entries(options.env).forEach(({ 0: key, 1: value }) => {
        if (value !== undefined) {
          env.push(`${key}=${value}`)
        }
      })
    }

    const preopens = []
    if (options.preopens !== undefined) {
      validateObject(options.preopens, 'options.preopens')
      ObjectEntries(options.preopens).forEach(
        ({ 0: key, 1: value }) =>
          preopens.push(String(key), String(value))
      )
    }

    const { stdin = 0, stdout = 1, stderr = 2 } = options
    validateInt32(stdin, 'options.stdin', 0)
    validateInt32(stdout, 'options.stdout', 0)
    validateInt32(stderr, 'options.stderr', 0)
    const stdio = [stdin, stdout, stderr]

    const wrap = new _WASI(args, env, preopens, stdio)

    for (const prop in wrap) {
      wrap[prop] = wrap[prop].bind(wrap)
    }

    if (options.returnOnExit !== undefined) {
      validateBoolean(options.returnOnExit, 'options.returnOnExit')
      if (options.returnOnExit)
        wrap.proc_exit = wasiReturnOnProcExit.bind(this)
    }

    this[kSetMemory] = wrap._setMemory
    delete wrap._setMemory
    this.wasiImport = wrap
    this[kStarted] = false
    this[kExitCode] = 0
    this[kInstance] = undefined
  }

  // Must not export _initialize, must export _start
  start (instance) {
    if (this[kStarted]) {
      throw new Error('WASI instance has already started')
    }
    this[kStarted] = true

    setupInstance(this, instance)

    const { _start, _initialize } = this[kInstance].exports

    validateFunction(_start, 'instance.exports._start')
    validateUndefined(_initialize, 'instance.exports._initialize')

    try {
      _start()
    } catch (err) {
      if (err !== kExitCode) {
        throw err
      }
    }

    return this[kExitCode]
  }

  // Must not export _start, may optionally export _initialize
  initialize (instance) {
    if (this[kStarted]) {
      throw new Error('WASI instance has already started')
    }
    this[kStarted] = true

    setupInstance(this, instance)

    const { _start, _initialize } = this[kInstance].exports
    
    validateUndefined(_start, 'instance.exports._start')
    if (_initialize !== undefined) {
      validateFunction(_initialize, 'instance.exports._initialize')
      _initialize()
    }
  }
}

function wasiReturnOnProcExit (rval) {
  this[kExitCode] = rval
  throw kExitCode
}
