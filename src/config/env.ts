import dotenv from 'dotenv'

dotenv.config()

export const LARK_DOMAIN = process.env.LARK_DOMAIN || 'https://open.larksuite.com'
export const LARK_CLIENT_ID = process.env.LARK_CLIENT_ID || ''
export const LARK_CLIENT_SECRET = process.env.LARK_CLIENT_SECRET || ''
export const LARK_REDIRECT_URI = process.env.LARK_REDIRECT_URI || ''
export const LARK_APP_TOKEN = process.env.LARK_APP_TOKEN
export const TASK_LIST_TABLE_NAME = process.env.TASK_LIST_TABLE_NAME

export const SERVER_PORT = process.env.PORT ? Number(process.env.PORT) : 3001
export const LOG_LEVEL = process.env.LOG_LEVEL||'info'
export const BACKEND_SERVER_URL = process.env.BACKEND_SERVER_URL


