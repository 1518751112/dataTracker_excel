import * as fs from 'fs'
import * as path from 'path'
import logger from './logger'

// 数据文件存储路径
const DATA_DIR = path.resolve(process.cwd(), 'data')
const BITABLE_DATA_FILE = path.join(DATA_DIR, 'bitable.json')

export enum BitableType {
    TASK = 'task',
    LOG = 'log'
}

/**
 * 飞书多维表格数据结构
 */
export interface BitableData {
  app_token: string
  default_table_id?: string
  folder_token: string
  name: string
  url: string
  type: BitableType,
  status: 'active' | 'inactive'
}

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    logger.info(`创建数据目录: ${DATA_DIR}`)
  }
}

/**
 * 读取所有多维表格数据
 * @returns 多维表格数据数组，如果文件不存在则返回空数组
 */
export function readAllBitables(): BitableData[] {
  try {
    ensureDataDir()
    if (!fs.existsSync(BITABLE_DATA_FILE)) {
      logger.info('多维表格数据文件不存在，返回空数组')
      return []
    }
    const content = fs.readFileSync(BITABLE_DATA_FILE, 'utf-8')
    const data = JSON.parse(content) as BitableData[]
    // logger.info(`成功读取 ${data.length} 条多维表格数据`)
    return data
  } catch (error) {
    logger.error(`读取多维表格数据失败: ${error}`)
    return []
  }
}

/**
 * 覆盖式写入所有多维表格数据
 * @param data 要写入的多维表格数据数组
 * @returns 是否写入成功
 */
export function writeAllBitables(data: BitableData[]): boolean {
  try {
    ensureDataDir()
    fs.writeFileSync(BITABLE_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    // logger.info(`成功写入 ${data.length} 条多维表格数据`)
    return true
  } catch (error) {
    logger.error(`写入多维表格数据失败: ${error}`)
    return false
  }
}

/**
 * 添加单条多维表格数据（读取后追加再写入）
 * @param item 要添加的多维表格数据
 * @returns 是否添加成功
 */
export function addBitable(item: BitableData): boolean {
  const data = readAllBitables()
  data.push(item)
  return writeAllBitables(data)
}

/**
 * 根据 app_token 查找多维表格数据
 * @param appToken 多维表格的 app_token
 * @returns 找到的数据，未找到返回 undefined
 */
export function findBitableByAppToken(appToken: string): BitableData | undefined {
  const data = readAllBitables()
  return data.find(item => item.app_token === appToken)
}

/**
 * 根据类型筛选多维表格数据
 * @param type 类型：'task' 或 'log'
 * @returns 符合类型的数据数组
 */
export function findBitablesByType(type: BitableType): BitableData[] {
  const data = readAllBitables()
  return data.filter(item => item.type === type)
}

/**
 * 根据 app_token 更新多维表格数据
 * @param appToken 要更新的多维表格的 app_token
 * @param updates 要更新的字段
 * @returns 是否更新成功
 */
export function updateBitableByAppToken(appToken: string, updates: Partial<BitableData>): boolean {
  const data = readAllBitables()
  const index = data.findIndex(item => item.app_token === appToken)
  if (index === -1) {
    logger.warn(`未找到 app_token 为 ${appToken} 的多维表格数据`)
    return false
  }
  data[index] = { ...data[index], ...updates }
  return writeAllBitables(data)
}

/**
 * 根据 app_token 删除多维表格数据
 * @param appToken 要删除的多维表格的 app_token
 * @returns 是否删除成功
 */
export function deleteBitableByAppToken(appToken: string): boolean {
  const data = readAllBitables()
  const newData = data.filter(item => item.app_token !== appToken)
  if (newData.length === data.length) {
    logger.warn(`未找到 app_token 为 ${appToken} 的多维表格数据`)
    return false
  }
  return writeAllBitables(newData)
}

export default {
  readAllBitables,
  writeAllBitables,
  addBitable,
  findBitableByAppToken,
  findBitablesByType,
  updateBitableByAppToken,
  deleteBitableByAppToken
}
