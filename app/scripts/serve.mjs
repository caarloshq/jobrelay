import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const config = new URL('../.env.local', import.meta.url)
if (existsSync(config)) process.loadEnvFile(fileURLToPath(config))
process.env.HOST ||= '127.0.0.1'
process.env.PORT ||= '4186'
await import('../dist/server/entry.mjs')
