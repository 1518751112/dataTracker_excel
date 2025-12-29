import express from "express";
import {stream as loggerStream} from "@lib/logger";
import bodyParser from 'body-parser'
import morgan from 'morgan'
import cors from 'cors'

export function middle(app: express.Express) {

    app.use(express.json({ limit: '2mb', type: ['application/json', 'application/*+json', '*/json'], verify: (req: any, _res, buf) => { req.rawBody = buf?.toString?.() } }))
    app.use(express.urlencoded({ extended: true }))
    app.use(bodyParser.json({ limit: '2mb' }))
    app.use(express.text({ type: 'text/*', limit: '2mb' }))
    // HTTP请求日志打印
    app.use(morgan('combined', { stream: loggerStream }))

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
            try { (req as any).body = JSON.parse((req as any).body) } catch { }
        }
        next()
    })
    // 允许跨域
    app.use(cors())

// 请求体调试打印（仅开发场景）
    app.use((req, _res, next) => {
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            try {
                console.log(`[REQ] ${req.method} ${req.originalUrl} headers=${JSON.stringify(req.headers)} body=${JSON.stringify(req.body)}`)
            } catch { }
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
            } catch { }
            return originalJson(body)
        }
        res.on('finish', () => {
            console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
        })
        next()
    })
}
