import { Router } from 'express'
import { ensureFieldsFromData, setSortByFieldName, upsertRecordByUniqueKey, listRecords, createApp, createTable, deleteTable, findTableByName, listViews, ensureFields, upsertRecordsBatch } from '../services/bitable'
import type { UpsertPayload } from '../types/bitable'
import { getToken } from '../services/larkAuth'

const router = Router()

router.post('/upsert', async (req, res) => {
  try {
    const access_token = getToken(req)
    const body: UpsertPayload = req.body
    if (!body?.appToken || !body?.tableId || !body?.data || !body?.uniqueKey) {
      return res.status(400).json({ error: '缺少必要参数: appToken, tableId, data, uniqueKey' })
    }
    await ensureFieldsFromData(access_token, body.appToken, body.tableId, body.data)
    if (body.sortField?.name) {
      await setSortByFieldName(access_token, body.appToken, body.tableId, body.sortField.name, body.sortField.order || 'asc')
    }
    const result = await upsertRecordByUniqueKey(access_token, body.appToken, body.tableId, body.data, body.uniqueKey)
    res.json({ data: result })
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message || '请求失败' })
  }
})

router.get('/records', async (req, res) => {
  try {
    const access_token = getToken(req)
    const appToken = String(req.query.appToken || '')
    const tableId = String(req.query.tableId || '')
    const viewId = req.query.viewId ? String(req.query.viewId) : undefined
    if (!appToken || !tableId) return res.status(400).json({ error: '缺少appToken或tableId' })
    const items = await listRecords(access_token, appToken, tableId, viewId)
    res.json({ items })
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message || '请求失败' })
  }
})

export default router

// 创建应用与表格
router.post('/create', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split(' ')[1]
    if (!access_token) return res.status(400).json({ error: '缺少access_token' })
    let payload: any = req.body
    if (!payload) payload = {}
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload) } catch { payload = {} }
    }
    const appName: string = String((payload.appName ?? req.query.appName ?? ''))
    const tableName: string = String((payload.tableName ?? req.query.tableName ?? ''))
    const fields = Array.isArray(payload.fields) ? payload.fields : []
    if (!appName || !tableName) return res.status(400).json({ error: '缺少appName或tableName' })
    // 优先按名称查找应用
    const app = await createApp(access_token, appName)
 
    // 新建应用通常自带默认表，按需删除
    console.log('新建应用通常自带默认表，按需删除', app)
    if (app?.default_table_id) {
      try { await deleteTable(access_token, app.app_token, app.default_table_id) } catch {}
    }
    
    const createdTable = await createTable(access_token, app.app_token, tableName, fields)
    return res.json({ app_token: app.app_token, table_id: createdTable.table_id, default_view_id: createdTable.default_view_id })
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message || '请求失败' })
  }
})

// 批量插入或更新记录
router.post('/upsert/batch', async (req, res) => {
  try {
    const access_token = getToken(req)
    let payload: any = req.body
    if (!payload) payload = {}
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload) } catch { payload = {} }
    }
    const appToken: string = String((payload.appToken ?? req.query.appToken ?? ''))
    const tableId: string = String((payload.tableId ?? req.query.tableId ?? ''))
    const uniqueKey: string = String((payload.uniqueKey ?? req.query.uniqueKey ?? ''))
    const dataArr: any[] = Array.isArray(payload.data) ? payload.data : []
    if (!appToken || !tableId || !uniqueKey) return res.status(400).json({ error: '缺少appToken或tableId或uniqueKey' })
    if (dataArr.length === 0) return res.status(400).json({ error: '缺少插入数据' })

    const keys = new Set<string>()
    for (const r of dataArr) { Object.keys(r || {}).forEach(k => keys.add(k)) }
    const specs = Array.from(keys).map(k => ({ field_name: k, type: 'Text' }))
    await ensureFields(access_token, appToken, tableId, specs as any)

    const result = await upsertRecordsBatch(access_token, appToken, tableId, uniqueKey, dataArr)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data || err.message || '请求失败' })
  }
})

