import { lark } from './http'
import { LARK_CLIENT_ID, LARK_CLIENT_SECRET, LARK_REDIRECT_URI } from '../config/env'


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
