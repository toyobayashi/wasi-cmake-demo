import {
  WasiErrno,
  WasiFileType
} from './wasi-types.js'
import { getRights } from './wasi-rights.js'

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
    errno = insertStdio(this, options.out, 1, '<stdout>', new StandardOutput(1024, console.log)).errno
    if (errno > 0) throw new WebAssembly.RuntimeError(WasiErrno[errno])
    errno = insertStdio(this, options.err, 2, '<stderr>', new StandardOutput(1024, console.error)).errno
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
