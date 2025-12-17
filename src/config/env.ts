import dotenv from 'dotenv'
dotenv.config()

export const LARK_DOMAIN = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
export const LARK_CLIENT_ID = process.env.LARK_CLIENT_ID || ''
export const LARK_CLIENT_SECRET = process.env.LARK_CLIENT_SECRET || ''
export const LARK_REDIRECT_URI = process.env.LARK_REDIRECT_URI || ''

export const SERVER_PORT = process.env.PORT ? Number(process.env.PORT) : 3001
