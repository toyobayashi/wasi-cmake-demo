import {
  WasiErrno,
  WasiFileType,
  WasiWhence
} from './wasi-types.js'
import { getRights } from './wasi-rights.js'

/**
 * @param {Uint8Array[]} buffers
 * @returns {Uint8Array}
 */
export function concatBuffer (buffers, size) {
  let total = 0
  if (typeof size === 'number' && size >= 0) {
    total = size
  } else {
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      total += buffer.length
    }
  }
  let pos = 0
  const ret = new Uint8Array(total)
  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    ret.set(buffer, pos)
    pos += buffer.length
  }
  return ret
}

class FileDescriptor {
  constructor (
    id,
    fd,
    path,
    realPath,
    type,
    rightsBase,
    rightsInheriting,
    preopen
  ) {
    this.id = id
    this.fd = fd
    this.path = path
    this.realPath = realPath
    this.type = type
    this.rightsBase = rightsBase
    this.rightsInheriting = rightsInheriting
    this.preopen = preopen
    this.stream = undefined
  }
}

class Stream {
  constructor (size) {
    this._pos = 0
    this._size = size || 0
  }

  seek (offset, whence) {
    if (whence === WasiWhence.SET) {
      this._pos = offset
    } else if (whence === WasiWhence.CUR) {
      this._pos += offset
    } else if (whence === WasiWhence.END) {
      this._pos = this._size - offset
    }
  }
}

class StandardInput extends Stream {
  constructor () {
    super(0)
  }

  seek (_offset, _whence) {}

  read () {
    const value = window.prompt()
    if (value === null) return new Uint8Array()
    const buffer = new TextEncoder().encode(value + '\n')
    return buffer
  }
}

class StandardOutput extends Stream {
  constructor (print) {
    super(0)
    this._print = print
    this._buf = null
  }

  seek (_offset, _whence) {}

  write (buffer) {
    if (this._buf) {
      buffer = concatBuffer([this._buf, buffer])
      this._buf = null
    }
    let written = 0
    let lastBegin = 0
    let index
    while ((index = buffer.indexOf(10, written)) !== -1) {
      const str = new TextDecoder().decode(buffer.subarray(lastBegin, index))
      this._print(str)
      written += index - lastBegin + 1
    }

    if (written < buffer.length) {
      this._buf = buffer.slice(written)
    }
  
    return written
  }
}

function insertStdio (table, fd, expected, name, stream) {
  const type = WasiFileType.CHARACTER_DEVICE
  const { base, inheriting } = getRights(fd, 2, type)
  const wrap = table.insert(fd, name, name, type, base, inheriting, 0, stream)
  const ret = {
    wrap,
    errno: WasiErrno.ESUCCESS
  }
  if (wrap.id !== expected) ret.errno = WasiErrno.EBADF
  return ret
}

export class FileDescriptorTable {
  constructor (options) {
    this.used = 0
    this.size = options.size
    this.fds = Array(options.size)

    let errno = 0
    errno = insertStdio(this, options.in, 0, '<stdin>', new StandardInput()).errno
    if (errno > 0) throw new WebAssembly.RuntimeError(WasiErrno[errno])
    errno = insertStdio(this, options.out, 1, '<stdout>', new StandardOutput(console.log)).errno
    if (errno > 0) throw new WebAssembly.RuntimeError(WasiErrno[errno])
    errno = insertStdio(this, options.err, 2, '<stderr>', new StandardOutput(console.error)).errno
    if (errno > 0) throw new WebAssembly.RuntimeError(WasiErrno[errno])
  }

  insert (fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen, stream) {
    let index = -1
    if (this.used >= this.size) {
      const newSize = this.size * 2
      this.fds.length = newSize
      index = this.size
      this.size = newSize
    } else {
      for (let i = 0; i < this.size; ++i) {
        if (this.fds[i] == null) {
          index = i
          break
        }
      }
    }

    const entry = new FileDescriptor(
      index,
      fd,
      mappedPath,
      realPath,
      type,
      rightsBase,
      rightsInheriting,
      preopen
    )
    entry.stream = stream
    this.fds[index] = entry
    this.used++
    return entry
  }

  get (id, base, inheriting) {
    const ret = {
      fileDescriptor: undefined,
      errno: WasiErrno.ESUCCESS
    }
    if (id > this.size) {
      ret.errno = WasiErrno.EBADF
      return ret
    }

    const entry = this.fds[id]
    if (!entry || entry.id !== id) {
      ret.errno = WasiErrno.EBADF
      return ret
    }

    /* Validate that the fd has the necessary rights. */
    if ((~entry.rightsBase & base) !== BigInt(0) || (~entry.rightsInheriting & inheriting) !== BigInt(0)) {
      ret.errno = WasiErrno.ENOTCAPABLE
      return ret
    }
    ret.fileDescriptor = entry
    return ret
  }
}
