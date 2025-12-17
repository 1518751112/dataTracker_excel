import express from 'express'
import bodyParser from 'body-parser'
import authRouter from './routes/auth'
import bitableRouter from './routes/bitable'
import cors from 'cors'
import path from 'path'
import { SERVER_PORT } from './config/env'


const app = express()
app.use(express.json({ limit: '2mb', type: ['application/json', 'application/*+json', '*/json'], verify: (req: any, _res, buf) => { req.rawBody = buf?.toString?.() } }))
app.use(express.urlencoded({ extended: true }))
app.use(bodyParser.json({ limit: '2mb' }))
app.use(express.text({ type: 'text/*', limit: '2mb' }))
// 统一错误处理（打印并返回JSON）
app.use((err: any, req: any, res: any, next: any) => {
  const status = err?.status || err?.response?.status || 500
  const detail = err?.response?.data || err?.message || '请求失败'
  console.error(`[ERROR] ${req?.method} ${req?.originalUrl}`, detail)
  if (res.headersSent) return next(err)
  res.status(status).json({ error: detail })
})

app.use((req, _res, next) => {
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && typeof (req as any).body === 'string') {
    try { (req as any).body = JSON.parse((req as any).body) } catch {}
  }
  next()
})
app.use(cors())
// 请求体调试打印（仅开发场景）
app.use((req, _res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try {
      console.log(`[REQ] ${req.method} ${req.originalUrl} headers=${JSON.stringify(req.headers)} body=${JSON.stringify(req.body)}`)
    } catch {}
  }
  next()
})
// 响应与错误打印过滤器
app.use((req, res, next) => {
  const start = Date.now()
  const originalJson = res.json.bind(res)
  res.json = (body: any) => {
    try {
      console.log(`[RESP] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${JSON.stringify(body)}`)
    } catch {}
    return originalJson(body)
  }
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
  })
  next()
})
// 静态托管 client 前端
const clientDir = path.join(process.cwd(), 'client')
app.use(express.static(clientDir))
console.log('静态目录:', clientDir);

app.use('/api/auth', authRouter)
app.use('/api/bitable', bitableRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

const PORT = SERVER_PORT ? Number(SERVER_PORT) : 3001
app.listen(PORT, () => {
  console.log(`TS Server running at http://localhost:${PORT}`)
})


