import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
const port = process.env.PORT || 5174

const app = express()

if (isProd) {
  app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1y', index: false }))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({
    root: __dirname,
    appType: 'spa',
    server: { middlewareMode: true },
  })
  app.use(vite.middlewares)
}

app.listen(port, () => {
  console.log(`WINSPACE ${isProd ? 'prod' : 'dev'} server → http://localhost:${port}`)
})
