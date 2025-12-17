import { Router } from 'express'
import { exchangeCodeForToken, fetchUserInfo } from '../services/larkAuth'
import { createApp, createTable, deleteTable } from '../services/bitable'

const router = Router()

router.get('/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '')
    if (!code) return res.status(400).json({ error: '缺少code' })
    const tokenData = await exchangeCodeForToken(code)
    let user: any = null
    if (tokenData?.access_token) {
      try {
        user = await fetchUserInfo(tokenData.access_token)
      } catch (e) {
        // 忽略用户信息失败，不影响令牌返回
      }
    }

    const create = String(req.query.create || 'false')
    if (create === 'true') {
      const appName = String(req.query.app_name || '测试表格')
      const tableName = String(req.query.table_name || '数据表名称')
      const app = await createApp(tokenData.access_token, appName)
      const created = await createTable(tokenData.access_token, app.app_token, tableName)
      if (created?.default_table_id) {
        await deleteTable(tokenData.access_token, app.app_token, created.default_table_id)
      }
      return res.json({ token: tokenData, user, app_token: app.app_token, table_id: created.table_id, default_view_id: created.default_view_id })
    }
    res.json({ token: tokenData, user })
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message || '请求失败' })
  }
})

export default router

// 获取用户信息（通过前端提供的用户 access_token）
router.get('/user/info', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '')
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return res.status(400).json({ error: '缺少Authorization Bearer token' })
    console.log('token', 111)
    const user = await fetchUserInfo(token)
    console.log('user', user)
    res.json(user)
  } catch (err: any) {
    console.log('err', err)
    res.status(500).json({ error: err.response?.data || err.message || '请求失败' })
  }
})

