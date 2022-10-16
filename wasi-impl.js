import { WasiErrno } from './wasi-types.js'

function debug (...args) {
  if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
    console.debug(...args)
  } else {
    if (process.env.DEBUG) {
      console.debug(...args)
    }
  }
}

class StandardInput {
  constructor () {
    this._bufs = []
  }

  _push () {
    const value = window.prompt()
    if (value === null) return false
    const buffer = new TextEncoder().encode(value + '\x0a')
    this._bufs.push(buffer)
    return true
  }

  read (u8arr) {
    if (this._bufs.length === 0) {
      if (!this._push()) {
        return -WasiErrno.ECANCELED
      }
    }

    let pos = 0
    let left = u8arr.length
    while (this._bufs.length > 0) {
      const buf = this._bufs.shift()
      if (left > buf.length) {
        u8arr.set(buf, pos)
        pos += buf.length
        left -= buf.length
      } else {
        u8arr.set(buf.subarray(0, left), pos)
        pos += left
        this._bufs.unshift(buf.slice(left))
        break
      }
    }
    return pos
  }
}

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

/** @class */
const WASI = /*#__PURE__*/ (function () {
  const _memory = new WeakMap()
  const _wasi = new WeakMap()

  function getMemory (wasi) {
    const memory = _memory.get(wasi)
    return {
      HEAPU8: new Uint8Array(memory.buffer),
      HEAPU16: new Uint16Array(memory.buffer),
      HEAP32: new Int32Array(memory.buffer),
      HEAPU32: new Uint32Array(memory.buffer)
    }
  }

  function WASI (args, env, preopens, stdio) {
    const encoder = new TextEncoder()
    const fds = []
    fds[stdio[0]] = new StandardInput()
    fds[stdio[1]] = new StandardOutput(1024, console.log)
    fds[stdio[2]] = new StandardOutput(1024, console.error)
  
    _wasi.set(this, {
      fds,
      args: args,
      argvBuf: encoder.encode(args.join('\0') + '\0'),
      env: env,
      envBuf: encoder.encode(env.join('\0') + '\0')
    })
  
    const _this = this
    this._setMemory = function _setMemory (m) {
      if (!(m instanceof WebAssembly.Memory)) {
        throw new TypeError('"instance.exports.memory" property must be a WebAssembly.Memory')
      }
      _memory.set(_this, m)
    }
  }
  
  WASI.prototype.args_get = function args_get (argv, argv_buf) {
    debug('args_get(%d, %d)', argv, argv_buf)
    if (argv === 0 || argv_buf === 0) {
      return WasiErrno.EINVAL
    }
    const { HEAPU8, HEAP32 } = getMemory(this)
    HEAP32[argv >> 2] = argv_buf
    const wasi = _wasi.get(this)
    const args = wasi.args
    let encoder
    for (let i = 1; i < args.length; ++i) {
      HEAP32[(argv >> 2) + i] = argv_buf + (encoder || (encoder = new TextEncoder())).encode(args.slice(0, i).join('\0') + '\0').length
    }
    HEAPU8.set(wasi.argvBuf, argv_buf)
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.args_sizes_get = function args_sizes_get (argc, argv_buf_size) {
      debug('args_sizes_get(%d, %d)', argc, argv_buf_size)
      if (argc === 0 || argv_buf_size === 0) {
        return WasiErrno.EINVAL
      }
      const { HEAP32, HEAPU32 } = getMemory(this)
      const wasi = _wasi.get(this)
      const args = wasi.args
      HEAP32[argc >> 2] = args.length
      HEAPU32[argv_buf_size >> 2] = wasi.argvBuf.length
      return WasiErrno.ESUCCESS
    }
  
  WASI.prototype.environ_get = function environ_get (environ, environ_buf) {
    debug('environ_get(%d, %d)', environ, environ_buf)
    if (environ === 0 || environ_buf === 0) {
      return WasiErrno.EINVAL
    }
    const { HEAPU8, HEAP32 } = getMemory(this)
    HEAP32[environ >> 2] = environ_buf
    const wasi = _wasi.get(this)
    const env = wasi.env
    let encoder
    for (let i = 1; i < env.length; ++i) {
      HEAP32[(environ >> 2) + i] = environ_buf + (encoder || (encoder = new TextEncoder())).encode(env.slice(0, i).join('\0') + '\0').length
    }
    HEAPU8.set(wasi.envBuf, environ_buf)
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.environ_sizes_get = function environ_sizes_get (len, buflen) {
    debug('environ_sizes_get(%d, %d)', len, buflen)
    if (len === 0 || buflen === 0) {
      return WasiErrno.EINVAL
    }
    const { HEAP32, HEAPU32 } = getMemory(this)
    const wasi = _wasi.get(this)
    HEAP32[len >> 2] = wasi.env.length
    HEAPU32[buflen >> 2] = wasi.envBuf.length
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.fd_close = function fd_close (fd) {
    debug('fd_close(%d)', fd)
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.fd_fdstat_get = function fd_fdstat_get (fd, fdstat) {
    debug('fd_fdstat_get(%d, %d)', fd, fdstat)
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.fd_seek = function fd_seek (fd, offset, whence, filesize) {
    debug('fd_seek(%d, %d, %d, %d)', fd, offset, whence, filesize)
    return WasiErrno.ESUCCESS
  }

  WASI.prototype.fd_read = function fd_read (fd, iovs, iovslen, size) {
    debug('fd_read(%d, %d, %d, %d)', fd, iovs, iovslen, size)
    if (iovs === 0 || size === 0) {
      return WasiErrno.EINVAL
    }
    const { HEAPU8, HEAP32, HEAPU32 } = getMemory(this)
    let nread = 0
    const wasi = _wasi.get(this)
    const stream = wasi.fds[fd]
    if (!stream) {
      HEAPU32[size >> 2] = 0
      return WasiErrno.EBADF
    }

    for (let i = 0; i < iovslen; ++i) {
      const buf = HEAP32[(iovs + (i * 8)) >> 2]
      const bufLen = HEAPU32[((iovs + (i * 8)) >> 2) + 1]

      const read = stream.read(HEAPU8.subarray(buf, buf + bufLen))
      if (read < 0) {
        HEAPU32[size >> 2] = 0
        return WasiErrno.ESUCCESS
      }
      nread += read
      if (read <= bufLen) {
        break
      }
    }

    HEAPU32[size >> 2] = nread
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.fd_write = function fd_write (fd, iovs, iovslen, size) {
    debug('fd_write(%d, %d, %d, %d)', fd, iovs, iovslen, size)
    if (iovs === 0 || size === 0) {
      return WasiErrno.EINVAL
    }
    const { HEAPU8, HEAP32, HEAPU32 } = getMemory(this)
    let nwritten = 0
    const wasi = _wasi.get(this)
    const stream = wasi.fds[fd]
    if (!stream) {
      HEAPU32[size >> 2] = 0
      return WasiErrno.EBADF
    }
    for (let i = 0; i < iovslen; ++i) {
      const buf = HEAP32[(iovs + (i * 8)) >> 2]
      const bufLen = HEAPU32[((iovs + (i * 8)) >> 2) + 1]
      if (bufLen === 0) continue
  
      const data = HEAPU8.subarray(buf, buf + bufLen)
      stream.write(data)
      nwritten += bufLen
    }
  
    HEAPU32[size >> 2] = nwritten
    return WasiErrno.ESUCCESS
  }
  
  WASI.prototype.proc_exit = function proc_exit (rval) {
    debug(`proc_exit(${rval})`)
    return WasiErrno.ESUCCESS
  }

  return WASI
})()

export { WASI }
