class OutputStream {
  constructor (size) {
    this._buf = new Uint8Array(size)
    this._pos = 0
  }

  write (buffer) {
    this._buf.set(buffer, this._pos)
    this._pos += buffer.byteLength
  }
}

class StandardOutput extends OutputStream {
  constructor (size, print) {
    super(size)
    this._print = print
  }
  write (buffer) {
    super.write(buffer)
    let index
    while ((index = this._buf.indexOf(10)) !== -1) {
      const str = new TextDecoder().decode(this._buf.subarray(0, index))
      this._print(str)
      this._buf.set(this._buf.subarray(index + 1, this._pos))
      this._pos -= (index + 1)
      this._buf.fill(0, this._pos)
    }
  }
}

const kExitCode = Symbol('kExitCode')
const kSetMemory = Symbol('kSetMemory')
const kStarted = Symbol('kStarted')
const kInstance = Symbol('kInstance')

function setupInstance (self, instance) {
  self[kInstance] = instance
  self[kSetMemory](instance.exports.memory)
}

class _WASI {
  constructor (args, env, preopens, stdio) {
    const encoder = new TextEncoder()
    const argBuf = encoder.encode(args.join('\0') + '\0')
    const envEntries = Object.entries(env).map(([key, value]) => `${key}=${value}`)
    const envBuf = encoder.encode(envEntries.join('\0') + '\0')
    const streams = []
    streams[stdio[0]] = undefined
    streams[stdio[1]] = new StandardOutput(1024, console.log)
    streams[stdio[2]] = new StandardOutput(1024, console.error)

    let _memory

    this._setMemory = function (m) {
      _memory = m
    }

    const getMemory = () => {
      return {
        HEAPU8: new Uint8Array(_memory.buffer),
        HEAPU16: new Uint16Array(_memory.buffer),
        HEAP32: new Int32Array(_memory.buffer),
        HEAPU32: new Uint32Array(_memory.buffer)
      }
    }

    this.proc_exit = function (rval) {
      console.log(`proc_exit(${rval});`)
    }
    this.args_get = function (argv, argv_buf) {
      const { HEAPU8, HEAP32 } = getMemory()
      HEAP32[argv >> 2] = argv_buf
      for (let i = 1; i < args.length; ++i) {
        HEAP32[(argv >> 2) + i] = argv_buf + encoder.encode(args.slice(0, i).join('\0') + '\0').length
      }
      HEAPU8.set(argBuf, argv_buf)
      return 0
    }
    this.args_sizes_get = function (argc, argv_buf_size) {
      const { HEAP32, HEAPU32 } = getMemory()
      HEAP32[argc >> 2] = args.length
      HEAPU32[argv_buf_size >> 2] = argBuf.length
      return 0
    }
    this.environ_get = function (environ, environ_buf) {
      const { HEAPU8, HEAP32 } = getMemory()
      HEAP32[environ >> 2] = environ_buf
      for (let i = 1; i < envEntries.length; ++i) {
        HEAP32[(environ >> 2) + i] = environ_buf + encoder.encode(envEntries.slice(0, i).join('\0') + '\0').length
      }
      HEAPU8.set(envBuf, environ_buf)
      return 0
    }
    this.environ_sizes_get = function (len, buflen) {
      const { HEAP32, HEAPU32 } = getMemory()
      HEAP32[len >> 2] = envEntries.length
      HEAPU32[buflen >> 2] = envBuf.length
      return 0
    }
    this.fd_close = function (fd) {
      return 0
    }
    this.fd_fdstat_get = function (fd, fdstat) {
      return 0
    }
    this.fd_seek = function (fd, offset, whence, filesize) {
      return 0
    }
    this.fd_write = function (fd, iovs, iovslen, size) {
      const { HEAPU8, HEAP32, HEAPU32 } = getMemory()
      let nwritten = 0
      const stream = streams[fd]
      for (let i = 0; i < iovslen; ++i) {
        const buf = HEAP32[(iovs + (i * 8)) >> 2]
        const bufLen = HEAPU32[((iovs + (i * 8)) >> 2) + 1]
        if (bufLen === 0) continue

        if (stream) {
          const data = HEAPU8.subarray(buf, buf + bufLen)
          stream.write(data)
        }
        nwritten += bufLen
      }

      HEAPU32[size >> 2] = nwritten
      return 0
    }
  }
}

export class WASI {
  constructor ({
    args = [],
    env = {},
    preopens,
    returnOnExit,
    stdin = 0,
    stdout = 1,
    stderr = 2
  } = {}) {
    const stdio = [stdin, stdout, stderr]
    const wrap = new _WASI(args, env, preopens, stdio)

    if (typeof returnOnExit === 'boolean') {
      if (returnOnExit) {
        wrap.proc_exit = wasiReturnOnProcExit.bind(this)
      }
    }

    this[kSetMemory] = wrap._setMemory
    delete wrap._setMemory
    this.wasiImport = wrap
    this[kStarted] = false
    this[kExitCode] = 0
    this[kInstance] = undefined
  }

  start (instance) {
    if (this[kStarted]) {
      throw new Error('WASI instance has already started')
    }
    this[kStarted] = true

    setupInstance(this, instance)

    const { _start, _initialize } = instance.exports
    if (typeof _start !== 'function') {
      throw new TypeError('instance.exports._start is not a function')
    }
    if (_initialize !== undefined) {
      throw new TypeError('instance.exports._initialize is not undefined')
    }

    try {
      _start()
    } catch (err) {
      if (err !== kExitCode) {
        throw err
      }
    }

    return this[kExitCode]
  }
}

function wasiReturnOnProcExit (rval) {
  this[kExitCode] = rval
  throw kExitCode
}
