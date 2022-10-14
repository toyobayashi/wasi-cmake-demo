import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('webpack').Configuration} */
const config = {
  mode: 'production',
  entry: {
    app: path.join(__dirname, './index.js')
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, './webpack')
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'asset/resource'
      }
    ]
  },
  experiments: {
    topLevelAwait: true
  }
}

export default config
