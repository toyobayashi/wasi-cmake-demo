export default async function (wrappedExports) {
  const {
    b64Encode,
    b64Decode
  } = wrappedExports
  
  const input = 'Hello wasi\n'
  const b64Str = b64Encode(input)
  console.log(b64Str)
  const origin = b64Decode(b64Str)
  const originStr = new TextDecoder().decode(origin)
  console.log(originStr === input)
}
