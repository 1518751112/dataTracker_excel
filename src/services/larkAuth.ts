import {lark} from './http'
import {LARK_CLIENT_ID, LARK_CLIENT_SECRET, LARK_REDIRECT_URI} from '../config/env'


export async function exchangeCodeForToken(code: string) {

  const resp = await lark.post('/authen/v2/oauth/token', {
    code,
    grant_type: 'authorization_code',
    client_id: LARK_CLIENT_ID,
    client_secret: LARK_CLIENT_SECRET,
    redirect_uri: LARK_REDIRECT_URI
  })
  const data = resp.data?.data || resp.data
  return data
}

export function getAccessToken(accessToken:string) {
  if (!accessToken) throw new Error('未授权：缺少access_token')
  return accessToken
}

export async function fetchUserInfo(userAccessToken: string) {
  const resp = await lark.get('/authen/v1/user_info', {
    headers: { Authorization: `Bearer ${userAccessToken}` }
  })
  return resp.data?.data || resp.data
}

//获取token
export function getToken(req:any) {
  const code = req.headers['authorization']?.split(' ')[1]
  if (!code) throw new Error('未授权：缺少code')
  return code
}

let tenantCache: { token: string; expireAt: number } | null = null

export async function getTenantAccessTokenInternal() {
  const resp = await lark.post('/auth/v3/tenant_access_token/internal', {
    app_id: LARK_CLIENT_ID,
    app_secret: LARK_CLIENT_SECRET,
  })
  const d = resp.data?.data || resp.data || {}
  const token = d.tenant_access_token || d.data?.tenant_access_token || d.token
  const expire = d.expire || d.data?.expire || 0
  return { token, expire }
}

export async function getTenantAccessToken() {
  const now = Date.now()
  if (tenantCache && tenantCache.expireAt > now + 120000) return tenantCache.token
  const { token, expire } = await getTenantAccessTokenInternal()
  if (!token) throw new Error('获取 tenant_access_token 失败')
  const expireAt = now + Math.max(0, (expire || 3600) * 1000)
  tenantCache = { token, expireAt }
  return token
}
