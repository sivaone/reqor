import { buildApp } from './app.js'

async function start() {
  const app = buildApp()
  await app.listen({ host: '127.0.0.1', port: 3000 })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
