/**
 * @template {Record<string, number | bigint>} T
 * @param {T} def 
 * @returns {T}
 */
function createEnum (def) {
  const e = {}
  Object.keys(def).forEach(key => {
    e[e[key] = def[key]] = key
  })
  return e
}

export const WasiErrno = createEnum({
  ESUCCESS:         0,
  E2BIG:            1,
  EACCES:           2,
  EADDRINUSE:       3,
  EADDRNOTAVAIL:    4,
  EAFNOSUPPORT:     5,
  EAGAIN:           6,
  EALREADY:         7,
  EBADF:            8,
  EBADMSG:          9,
  EBUSY:           10,
  ECANCELED:       11,
  ECHILD:          12,
  ECONNABORTED:    13,
  ECONNREFUSED:    14,
  ECONNRESET:      15,
  EDEADLK:         16,
  EDESTADDRREQ:    17,
  EDOM:            18,
  EDQUOT:          19,
  EEXIST:          20,
  EFAULT:          21,
  EFBIG:           22,
  EHOSTUNREACH:    23,
  EIDRM:           24,
  EILSEQ:          25,
  EINPROGRESS:     26,
  EINTR:           27,
  EINVAL:          28,
  EIO:             29,
  EISCONN:         30,
  EISDIR:          31,
  ELOOP:           32,
  EMFILE:          33,
  EMLINK:          34,
  EMSGSIZE:        35,
  EMULTIHOP:       36,
  ENAMETOOLONG:    37,
  ENETDOWN:        38,
  ENETRESET:       39,
  ENETUNREACH:     40,
  ENFILE:          41,
  ENOBUFS:         42,
  ENODEV:          43,
  ENOENT:          44,
  ENOEXEC:         45,
  ENOLCK:          46,
  ENOLINK:         47,
  ENOMEM:          48,
  ENOMSG:          49,
  ENOPROTOOPT:     50,
  ENOSPC:          51,
  ENOSYS:          52,
  ENOTCONN:        53,
  ENOTDIR:         54,
  ENOTEMPTY:       55,
  ENOTRECOVERABLE: 56,
  ENOTSOCK:        57,
  ENOTSUP:         58,
  ENOTTY:          59,
  ENXIO:           60,
  EOVERFLOW:       61,
  EOWNERDEAD:      62,
  EPERM:           63,
  EPIPE:           64,
  EPROTO:          65,
  EPROTONOSUPPORT: 66,
  EPROTOTYPE:      67,
  ERANGE:          68,
  EROFS:           69,
  ESPIPE:          70,
  ESRCH:           71,
  ESTALE:          72,
  ETIMEDOUT:       73,
  ETXTBSY:         74,
  EXDEV:           75,
  ENOTCAPABLE:     76
})

export const WasiFileType = createEnum({
  UNKNOWN:          0,
  BLOCK_DEVICE:     1,
  CHARACTER_DEVICE: 2,
  DIRECTORY:        3,
  REGULAR_FILE:     4,
  SOCKET_DGRAM:     5,
  SOCKET_STREAM:    6,
  SYMBOLIC_LINK:    7
})

export const WasiRights = createEnum({
  FD_DATASYNC:             (BigInt(1) << BigInt(0)),
  FD_READ:                 (BigInt(1) << BigInt(1)),
  FD_SEEK:                 (BigInt(1) << BigInt(2)),
  FD_FDSTAT_SET_FLAGS:     (BigInt(1) << BigInt(3)),
  FD_SYNC:                 (BigInt(1) << BigInt(4)),
  FD_TELL:                 (BigInt(1) << BigInt(5)),
  FD_WRITE:                (BigInt(1) << BigInt(6)),
  FD_ADVISE:               (BigInt(1) << BigInt(7)),
  FD_ALLOCATE:             (BigInt(1) << BigInt(8)),
  PATH_CREATE_DIRECTORY:   (BigInt(1) << BigInt(9)),
  PATH_CREATE_FILE:        (BigInt(1) << BigInt(10)),
  PATH_LINK_SOURCE:        (BigInt(1) << BigInt(11)),
  PATH_LINK_TARGET:        (BigInt(1) << BigInt(12)),
  PATH_OPEN:               (BigInt(1) << BigInt(13)),
  FD_READDIR:              (BigInt(1) << BigInt(14)),
  PATH_READLINK:           (BigInt(1) << BigInt(15)),
  PATH_RENAME_SOURCE:      (BigInt(1) << BigInt(16)),
  PATH_RENAME_TARGET:      (BigInt(1) << BigInt(17)),
  PATH_FILESTAT_GET:       (BigInt(1) << BigInt(18)),
  PATH_FILESTAT_SET_SIZE:  (BigInt(1) << BigInt(19)),
  PATH_FILESTAT_SET_TIMES: (BigInt(1) << BigInt(20)),
  FD_FILESTAT_GET:         (BigInt(1) << BigInt(21)),
  FD_FILESTAT_SET_SIZE:    (BigInt(1) << BigInt(22)),
  FD_FILESTAT_SET_TIMES:   (BigInt(1) << BigInt(23)),
  PATH_SYMLINK:            (BigInt(1) << BigInt(24)),
  PATH_REMOVE_DIRECTORY:   (BigInt(1) << BigInt(25)),
  PATH_UNLINK_FILE:        (BigInt(1) << BigInt(26)),
  POLL_FD_READWRITE:       (BigInt(1) << BigInt(27)),
  SOCK_SHUTDOWN:           (BigInt(1) << BigInt(28)),
  SOCK_ACCEPT:             (BigInt(1) << BigInt(29))
})

export const WasiWhence = createEnum({
  SET: 0,
  CUR: 1,
  END: 2
})
