import {lark, withAuth} from './http'
import {getAccessToken} from './larkAuth'
import type {FieldSpec, SortOrder} from '../types/bitable'

function auth(accessToken: string) {
  return withAuth(getAccessToken(accessToken))
}
export interface IListRecordsResponse<T=any> {
    fields:T,
    record_id:string,
    id:string
}

export async function createApp(accessToken: string, name: string,folderToken?:string) {
  const resp = await lark.post('/bitable/v1/apps', { name,folder_token: folderToken}, auth(accessToken))
  return resp.data.data.app
}

/**
 * 复制多维表格
 * @param accessToken 访问令牌
 * @param appToken 源多维表格的 app_token
 * @param name 复制后的多维表格名称（可选）
 * @param folderToken 目标文件夹 token（可选，不传则复制到根目录）
 * @param withoutContent 是否不复制内容，true 表示只复制结构不复制数据（可选，默认 false）
 * @returns 复制后的多维表格信息
 */
export async function copyApp(
  accessToken: string,
  appToken: string,
  name?: string,
  folderToken?: string,
  withoutContent?: boolean
) {
  const payload: Record<string, any> = {}
  if (name) payload.name = name
  if (folderToken) payload.folder_token = folderToken
  if (withoutContent !== undefined) payload.without_content = withoutContent

  const resp = await lark.post(`/bitable/v1/apps/${appToken}/copy`, payload, auth(accessToken))
  if (resp.data.code !== 0) {
    throw new Error(`复制多维表格失败: ${resp.data.msg || JSON.stringify(resp.data)}`)
  }
  return resp.data.data.app
}

export async function listTables(accessToken: string, appToken: string) {
  const resp = await lark.get(`/bitable/v1/apps/${appToken}/tables?page_size=100`, auth(accessToken))
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
  const resp = await lark.post(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, payload, auth(accessToken))
  if(resp.data.code!=0){
    throw new Error(`插入记录失败: ${resp.data.error.message || JSON.stringify(resp.data)}`)
  }
  return resp.data.data
}

export async function listRecords<T=any>(accessToken: string, appToken: string, tableId: string, viewId?: string):Promise<IListRecordsResponse<T>[]> {
  const resp = await lark.get(`/bitable/v1/apps/${appToken}/tables/${tableId}/records${viewId ? `?view_id=${viewId}` : ''}`, auth(accessToken))
  return resp.data.data?.items || []
}

/**
 * 搜索记录（支持分页）
 * @param accessToken 访问令牌
 * @param appToken 多维表格的 app_token
 * @param tableId 数据表的 table_id
 * @param body 内容
 * @param query 搜索条件（包含 filter、field_names、page_size、page_token 等）
 * @returns 搜索结果，包含 items 和 page_token
 */
export async function searchRecords(accessToken: string, appToken: string, tableId: string, body: any,query?:any) {
  const resp = await lark.post(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`, body, {
    ...auth(accessToken),
    params: query
  })
  return {
    items: resp.data.data?.items || [],
    page_token: resp.data.data?.page_token,
    has_more: resp.data.data?.has_more || false,
    total: resp.data.data?.total
  }
}

export async function searchRecordsByFieldValues(accessToken: string, appToken: string, tableId: string, fieldName: string, values: any[]) {
  if (!values || values.length === 0) return []
  const fieldId = await getFieldIdByName(accessToken, appToken, tableId, fieldName)
  if (!fieldId) throw new Error(`找不到字段: ${fieldName}`)
  const searchBody = {
    filter: { conjunction: 'and', conditions: [{ field_id: fieldId, operator: 'is', value: values.slice(0, 10) }] },
    page_size: Math.min(values.length, 500)
  }
  const result = await searchRecords(accessToken, appToken, tableId, searchBody)
  return result.items
}

export async function updateRecord(accessToken: string, appToken: string, tableId: string, recordId: string, fields: Record<string, any>) {
  const resp = await lark.put(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, { fields }, auth(accessToken))
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
  if (found.items.length > 0) {
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
  AutoNumber: 1005,
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

/**
 * 批量删除记录
 * @param accessToken 访问令牌
 * @param appToken 多维表格的 app_token
 * @param tableId 数据表的 table_id
 * @param recordIds 要删除的记录 ID 数组（单次最多 500 条）
 * @returns 删除结果
 */
export async function batchDeleteRecords(
  accessToken: string,
  appToken: string,
  tableId: string,
  recordIds: string[]
) {
  if (!recordIds || recordIds.length === 0) {
    return { deleted: 0 }
  }
  const resp = await lark.post(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`,
    { records: recordIds },
    auth(accessToken)
  )
  if (resp.data.code !== 0) {
    throw new Error(`批量删除记录失败: ${resp.data.msg || JSON.stringify(resp.data)}`)
  }
  return { deleted: recordIds.length, data: resp.data.data }
}

/**
 * 获取数据表中所有记录的 ID（使用 searchRecords 接口，支持分页）
 * @param accessToken 访问令牌
 * @param appToken 多维表格的 app_token
 * @param tableId 数据表的 table_id
 * @returns 所有记录的 ID 数组
 */
async function getAllRecordIds(
  accessToken: string,
  appToken: string,
  tableId: string
): Promise<string[]> {
  // 获取第一个字段名，用于减少返回数据量
  const fields = await listFields(accessToken, appToken, tableId)
  const firstFieldName = fields[0]?.field_name
  if (!firstFieldName) {
    return []
  }

  const recordIds: string[] = []
  let pageToken: string | undefined

  do {
    const query: any = {
      page_size: 500
    }
    const body: any = {
      field_names: [firstFieldName],
    }
    if (pageToken) {
      query.page_token = pageToken
    }
    const result = await searchRecords(accessToken, appToken, tableId, body,query)
    for (const item of result.items) {
      if (item.record_id) {
        recordIds.push(item.record_id)
      }
    }
    pageToken = result.page_token
  } while (pageToken)

  return recordIds
}

/**
 * 清空指定数据表的所有记录
 * @param accessToken 访问令牌
 * @param appToken 多维表格的 app_token
 * @param tableId 数据表的 table_id
 * @returns 删除统计信息
 */
export async function clearTableRecords(
  accessToken: string,
  appToken: string,
  tableId: string
) {
  const recordIds = await getAllRecordIds(accessToken, appToken, tableId)
  if (recordIds.length === 0) {
    return { tableId, deleted: 0 }
  }

  // 将记录ID分成每组500条
  const chunks: string[][] = []
  for (let i = 0; i < recordIds.length; i += 500) {
    chunks.push(recordIds.slice(i, i + 500))
  }

  let totalDeleted = 0
  const concurrency = 20 // 并发数
  // 并发删除，每次最多同时请求20个批次
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(chunk => batchDeleteRecords(accessToken, appToken, tableId, chunk))
    )
    for (const result of results) {
      totalDeleted += result.deleted
    }
  }

  return { tableId, deleted: totalDeleted }
}

/**
 * 清空多维表格中所有数据表的记录
 * @param accessToken 访问令牌
 * @param appToken 多维表格的 app_token
 * @returns 各数据表的删除统计信息
 */
export async function clearAllTablesRecords(
  accessToken: string,
  appToken: string
) {
  // 获取所有数据表
  const tables = await listTables(accessToken, appToken)
  if (!tables || tables.length === 0) {
    return { tables: [], totalDeleted: 0 }
  }

  const results: { tableId: string; tableName: string; deleted: number }[] = []
  let totalDeleted = 0

  const concurrency = 2 // 同时处理2个表
  // 并发清空数据表，每次最多同时处理2个表
  for (let i = 0; i < tables.length; i += concurrency) {
    const batch = tables.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (table: any) => {
        const result = await clearTableRecords(accessToken, appToken, table.table_id)
        return {
          tableId: table.table_id,
          tableName: table.name,
          deleted: result.deleted
        }
      })
    )
    for (const r of batchResults) {
      results.push(r)
      totalDeleted += r.deleted
    }
  }

  return { tables: results, totalDeleted }
}

