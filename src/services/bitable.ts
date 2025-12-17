import { lark, withAuth } from './http'
import { getAccessToken } from './larkAuth'
import type { FieldSpec, SortOrder } from '../types/bitable'

function auth(accessToken: string) {
  return withAuth(getAccessToken(accessToken))
}

export async function createApp(accessToken: string, name: string) {
  const resp = await lark.post('/bitable/v1/apps', { name }, auth(accessToken))
  return resp.data.data.app
}

export async function listTables(accessToken: string, appToken: string) {
  const resp = await lark.get(`/bitable/v1/apps/${appToken}/tables`, auth(accessToken))
  return resp.data.data?.items || []
}

export async function findTableByName(accessToken: string, appToken: string, name: string) {
  const items = await listTables(accessToken, appToken)
  return items.find((t: any) => t.name === name) || null
}

export async function createTable(accessToken: string, appToken: string, name: string, fields: FieldSpec[] = []) {
  const initialFields = (Array.isArray(fields) && fields.length > 0)
    ? fields
    : [{ field_name: 'title', type: 'Text' }]
  const normalized = initialFields.map(normalizeFieldSpec).filter(Boolean) as any[]
  const resp = await lark.post(`/bitable/v1/apps/${appToken}/tables`, { table: { name, fields: normalized } }, auth(accessToken))
  return resp.data.data
}

export async function deleteTable(accessToken: string, appToken: string, tableId: string) {
  await lark.delete(`/bitable/v1/apps/${appToken}/tables/${tableId}`, auth(accessToken))
}

export async function listFields(accessToken: string, appToken: string, tableId: string) {
  const resp = await lark.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=500`, auth(accessToken))
  return resp.data.data?.items || []
}

export async function createField(accessToken: string, appToken: string, tableId: string, spec: FieldSpec) {
  const payload = normalizeFieldSpec(spec)
  const resp = await lark.post(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, payload as any, auth(accessToken))
  return resp.data.data
}

export async function ensureFields(accessToken: string, appToken: string, tableId: string, fields: FieldSpec[]) {
  const existing = await listFields(accessToken, appToken, tableId)
  const existingNames = new Set(existing.map((f: any) => f.field_name))
  const toCreate = fields.filter(spec => !existingNames.has(spec.field_name))
  const created: any[] = []
  const limit = 5
  for (let i = 0; i < toCreate.length; i += limit) {
    const chunk = toCreate.slice(i, i + limit)
    const results = await Promise.all(chunk.map(spec => createField(accessToken, appToken, tableId, spec)))
    created.push(...results)
  }
  return { created, existing }
}

export async function getFieldIdByName(accessToken: string, appToken: string, tableId: string, fieldName: string) {
  const fields = await listFields(accessToken, appToken, tableId)
  const f = fields.find((x: any) => x.field_name === fieldName)
  return f?.field_id || null
}

export async function listViews(accessToken: string, appToken: string, tableId: string) {
  const resp = await lark.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/views`, auth(accessToken))
  return resp.data.data?.items || []
}

export async function setViewSort(accessToken: string, appToken: string, tableId: string, viewId: string, sorts: { field_id: string; order: SortOrder }[]) {
  const payload = { view_type: 'grid', property: { sorts } }
  await lark.patch(`/bitable/v1/apps/${appToken}/tables/${tableId}/views/${viewId}`, payload, auth(accessToken))
}

export async function setSortByFieldName(accessToken: string, appToken: string, tableId: string, fieldName: string, order: SortOrder = 'asc') {
  const views = await listViews(accessToken, appToken, tableId)
  const viewId = views[0]?.view_id
  if (!viewId) throw new Error('找不到视图')
  const fieldId = await getFieldIdByName(accessToken, appToken, tableId, fieldName)
  if (!fieldId) throw new Error(`找不到字段: ${fieldName}`)
  await setViewSort(accessToken, appToken, tableId, viewId, [{ field_id: fieldId, order }])
}

export async function insertRecords(accessToken: string, appToken: string, tableId: string, records: Record<string, any>[]) {
  const payload = { records: records.map(r => ({ fields: r })) }
  const resp = await lark.post(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, payload, auth(accessToken))
  return resp.data.data
}

export async function listRecords(accessToken: string, appToken: string, tableId: string, viewId?: string) {
  const resp = await lark.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/records${viewId ? `?view_id=${viewId}` : ''}`, auth(accessToken))
  return resp.data.data?.items || []
}

export async function searchRecords(accessToken: string, appToken: string, tableId: string, body: any) {
  const resp = await lark.post(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`, body, auth(accessToken))
  return resp.data.data?.items || []
}

export async function searchRecordsByFieldValues(accessToken: string, appToken: string, tableId: string, fieldName: string, values: any[]) {
  if (!values || values.length === 0) return []
  const fieldId = await getFieldIdByName(accessToken, appToken, tableId, fieldName)
  if (!fieldId) throw new Error(`找不到字段: ${fieldName}`)
  const searchBody = {
    filter: { conjunction: 'and', conditions: [{ field_id: fieldId, operator: 'is', value: values.slice(0, 10) }] },
    page_size: Math.min(values.length, 500)
  }
  return await searchRecords(accessToken, appToken, tableId, searchBody)
}

export async function updateRecord(accessToken: string, appToken: string, tableId: string, recordId: string, fields: Record<string, any>) {
  const resp = await lark.patch(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, { fields }, auth(accessToken))
  return resp.data.data
}

export async function upsertRecordByUniqueKey(accessToken: string, appToken: string, tableId: string, data: Record<string, any>, uniqueKey: string) {
  const uniqueVal = data[uniqueKey]
  if (uniqueVal === undefined) throw new Error(`缺少唯一键: ${uniqueKey}`)
  const fieldId = await getFieldIdByName(accessToken, appToken, tableId, uniqueKey)
  if (!fieldId) throw new Error(`找不到唯一键字段: ${uniqueKey}`)
  const searchBody = {
    filter: { conjunction: 'and', conditions: [{ field_id: fieldId, operator: 'is', value: uniqueVal }] },
    page_size: 1
  }
  const found = await searchRecords(accessToken, appToken, tableId, searchBody)
  if (found.length > 0) {
    const recordId = found[0].record_id
    return await updateRecord(accessToken, appToken, tableId, recordId, data)
  } else {
    const ins = await insertRecords(accessToken, appToken, tableId, [data])
    return ins
  }
}

export async function upsertRecordsBatch(accessToken: string, appToken: string, tableId: string, uniqueKey: string, dataArr: Record<string, any>[]) {
  const normalized = (Array.isArray(dataArr) ? dataArr : []).filter(r => r && r[uniqueKey] !== undefined)
  const keys = new Set<string>()
  for (const r of normalized) Object.keys(r).forEach(k => keys.add(k))
  const specs: FieldSpec[] = Array.from(keys).map(k => ({ field_name: k, type: 'Text' }))
  await ensureFields(accessToken, appToken, tableId, specs)

  const allVals = Array.from(new Set(normalized.map(r => r[uniqueKey])))
  const foundMap = new Map<any, string>()
  for (let i = 0; i < allVals.length; i += 10) {
    const chunk = allVals.slice(i, i + 10)
    const items = await searchRecordsByFieldValues(accessToken, appToken, tableId, uniqueKey, chunk)
    for (const it of items) {
      const v = it.fields?.[uniqueKey]
      if (v !== undefined) foundMap.set(v, it.record_id)
    }
  }

  const toCreate: Record<string, any>[] = []
  const toUpdate: { id: string; fields: Record<string, any> }[] = []
  for (const r of normalized) {
    const v = r[uniqueKey]
    const existing = foundMap.get(v)
    if (existing) toUpdate.push({ id: existing, fields: r })
    else toCreate.push(r)
  }

  let created = 0
  let updated = 0
  let createResult: any = null
  if (toCreate.length > 0) {
    createResult = await insertRecords(accessToken, appToken, tableId, toCreate)
    created = toCreate.length
  }
  const updateResults: any[] = []
  for (const u of toUpdate) {
    const r = await updateRecord(accessToken, appToken, tableId, u.id, u.fields)
    updateResults.push(r)
    updated++
  }
  return { created, updated, createResult, updateResults }
}

export async function ensureFieldsFromData(accessToken: string, appToken: string, tableId: string, data: Record<string, any>) {
  const specs: FieldSpec[] = Object.keys(data).map(k => ({ field_name: k, type: 'Text' }))
  await ensureFields(accessToken, appToken, tableId, specs)
}

// 字段类型映射：字符串到飞书枚举数字
const FIELD_TYPE_MAP: Record<string, number> = {
  Text: 1,
  Number: 2,
  SingleSelect: 3,
  MultiSelect: 4,
  DateTime: 5,
  Attachment: 15,
  User: 11,
}

function normalizeFieldSpec(spec: FieldSpec) {
  const name = spec.field_name
  let typeVal: any = spec.type
  let property = spec.property || {}

  // 若传字符串类型，进行映射；传数字则直接使用
  if (typeof typeVal === 'string') {
    const mapped = FIELD_TYPE_MAP[typeVal]
    // 对于选择类若未提供options，降级为文本，避免校验失败
    if ((typeVal === 'SingleSelect' || typeVal === 'MultiSelect') && (!property.options || property.options.length === 0)) {
      typeVal = FIELD_TYPE_MAP['Text']
      property = {}
    } else {
      typeVal = mapped || FIELD_TYPE_MAP['Text']
    }
  } else if (typeof typeVal !== 'number') {
    typeVal = FIELD_TYPE_MAP['Text']
  }

  return { field_name: name, type: typeVal, property }
}

