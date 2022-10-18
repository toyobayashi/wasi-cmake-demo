import {
  WasiErrno,
  WasiRights,
} from './wasi-types.js'

import { FileDescriptorTable, concatBuffer } from './wasi-fd.js'

function debug (...args) {
  if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
    console.debug(...args)
  } else {
    if (process.env.DEBUG) {
      console.debug(...args)
    }
  }
}

/**
 * @param {Uint8Array[]} targets
 * @param {Uint8Array} src
 * @returns {number}
 */
function copyMemory (targets, src) {
  if (targets.length === 0 || src.length === 0) return 0
  let copied = 0
  let left = src.length - copied
  for (let i = 0; i < targets.length; ++i) {
    const target = targets[i]
    if (left < target.length) {
      target.set(src.subarray(copied, copied + left), 0)
      copied += left
      left = 0
      return copied
    }

    target.set(src.subarray(copied, copied + target.length), 0)
    copied += target.length
    left -= target.length
  }
  return copied
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
      HEAPU32: new Uint32Array(memory.buffer),
      HEAPU64: new BigUint64Array(memory.buffer)
    }
  }

  const encoder = new TextEncoder()

  function WASI (args, env, preopens, stdio) {
    _wasi.set(this, {
      fds: new FileDescriptorTable({
        size: 3,
        in: stdio[0],
        out: stdio[1],
        err: stdio[2]
      }),
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
    for (let i = 1; i < args.length; ++i) {
      HEAP32[(argv >> 2) + i] = argv_buf + encoder.encode(args.slice(0, i).join('\0') + '\0').length
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
    for (let i = 1; i < env.length; ++i) {
      HEAP32[(environ >> 2) + i] = environ_buf + encoder.encode(env.slice(0, i).join('\0') + '\0').length
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
    if (fdstat === 0) {
      return WasiErrno.EINVAL
    }
    const wasi = _wasi.get(this)
    const { fileDescriptor, errno } = wasi.fds.get(fd, BigInt(0), BigInt(0))
    if (errno > 0) {
      return errno
    }
    const { HEAPU16, HEAPU64 } = getMemory(this)
    HEAPU16[fdstat >> 1] = fileDescriptor.type
    HEAPU16[(fdstat + 2) >> 1] = 0
    HEAPU64[(fdstat + 8) >> 3] = fileDescriptor.rightsBase
    HEAPU64[(fdstat + 16) >> 3] = fileDescriptor.rightsInheriting
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

    const wasi = _wasi.get(this)
    const { fileDescriptor, errno } = wasi.fds.get(fd, WasiRights.FD_READ, BigInt(0))
    if (errno > 0) {
      HEAPU32[size >> 2] = 0
      return errno
    }

    const buffer = fileDescriptor.stream.read()
    const ioVecs = Array.from({ length: iovslen }, (_, i) => {
      const buf = HEAP32[(iovs + (i * 8)) >> 2]
      const bufLen = HEAPU32[((iovs + (i * 8)) >> 2) + 1]
      return HEAPU8.subarray(buf, buf + bufLen)
    })
    const nread = copyMemory(ioVecs, buffer)

    HEAPU32[size >> 2] = nread
    return WasiErrno.ESUCCESS
  }

  WASI.prototype.fd_write = function fd_write (fd, iovs, iovslen, size) {
    debug('fd_write(%d, %d, %d, %d)', fd, iovs, iovslen, size)
    if (iovs === 0 || size === 0) {
      return WasiErrno.EINVAL
    }
    const { HEAPU8, HEAP32, HEAPU32 } = getMemory(this)

    const wasi = _wasi.get(this)
    const { fileDescriptor, errno } = wasi.fds.get(fd, WasiRights.FD_WRITE, BigInt(0))
    if (errno > 0) {
      HEAPU32[size >> 2] = 0
      return errno
    }

    const buffer = concatBuffer(Array.from({ length: iovslen }, (_, i) => {
      const buf = HEAP32[(iovs + (i * 8)) >> 2]
      const bufLen = HEAPU32[((iovs + (i * 8)) >> 2) + 1]
      return HEAPU8.subarray(buf, buf + bufLen)
    }))
    const nwritten = fileDescriptor.stream.write(buffer)

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
