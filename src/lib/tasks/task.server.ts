import logger from '@/lib/logger'
import {LARK_APP_TOKEN, TASK_LIST_TABLE_NAME} from '@/config/env'
import {createTable, findTableByName, insertRecords, listRecords, listTables, updateRecord} from '@/services/bitable'
import {BackendDataScalerService, IKeywordData} from '@/services/backend.datascaler'
import {getTenantAccessToken} from '@/services/larkAuth'
import dayjs from "dayjs";

function bucketName(asin: string, d = new Date()) {
    const day = d.getDate()
    const b = Math.ceil(day / 10).toString()
    return `${dayjs(d).format("YYMM")}${b}_${asin}`
}

function getChildTableFields() {
    return [
        {field_name: '关联关键词', type: 'Text'},
        {field_name: '抓取时间', type: 'Text'},
        {field_name: '流量占比', type: 'Number'},
        {field_name: '预估周曝光量', type: 'Number'},
        {field_name: '流量词类型', type: 'Text'},
        {field_name: '自然流量占比', type: 'Number'},
        {field_name: '广告流量占比', type: 'Number'},
        {field_name: '自然排名', type: 'Number'},
        {field_name: '自然排名页码', type: 'Number'},
        {field_name: '更新时间', type: 'Text'},
        {field_name: '广告排名', type: 'Number'},
        {field_name: '广告排名页码', type: 'Number'},
        {field_name: 'ABA周排名', type: 'Number'},
        {field_name: '月搜索量', type: 'Number'},
        {field_name: 'SPR', type: 'Number'},
        {field_name: '标题密度', type: 'Number'},
        {field_name: '购买量', type: 'Number'},
        {field_name: '购买率', type: 'Number'},
        {field_name: '展示量', type: 'Number'},
        {field_name: '点击量', type: 'Number'},
        {field_name: '商品数', type: 'Number'},
        {field_name: '需供比', type: 'Number'},
        {field_name: '广告竞品数', type: 'Number'},
        {field_name: '点击总占比', type: 'Number'},
        {field_name: '转化总占比', type: 'Number'},
        {field_name: 'PPC价格', type: 'Number'},
        {field_name: '建议最低竞价', type: 'Number'},
        {field_name: '建议最高竞价', type: 'Number'},
    ]
}

//转为百分比同时加上%
function toPercentage(value: number | null | undefined) {
    if (value === null || value === undefined) return null
    return (value * 100).toFixed(2) + '%'
}

function mapKeywordToRecord(k: IKeywordData) {
    const nowTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return {
        '关联关键词': k.keywords,
        '抓取时间': nowTime,
        '流量占比': toPercentage(k.trafficPercentage),
        '预估周曝光量': k.calculatedWeeklySearches ?? null,
        '流量词类型': k.position ?? null,
        '自然流量占比': toPercentage(k.naturalRatio ?? null),
        '广告流量占比': toPercentage(k.adRatio ?? null),
        '自然排名': k.rankPosition?.position ?? k.rankPosition?.index ?? null,
        '自然排名页码': k.rankPosition?`第${k.rankPosition.page}页 ${k.rankPosition.position}/${k.rankPosition.pageSize}`:null,
        '更新时间': k.rankPosition?.updatedTime?`中:${dayjs(k.rankPosition?.updatedTime).format('MM.DD HH:mm')}\n美:${dayjs(k.rankPosition?.updatedTime).add(8, 'hour').format('MM.DD HH:mm')}`:null,
        '广告排名': k.adPosition?k.adPosition.position : "前3页无排名",
        '广告排名页码': k.adPosition?`第${k.adPosition.page}页 ${k.adPosition.position}/${k.adPosition.pageSize}` : null,
        'ABA周排名': k.searchesRank ?? null,
        '月搜索量': k.searches ?? null,
        'SPR': k.cprExact ?? null,
        '标题密度': k.titleDensityExact ?? null,
        '购买量': k.purchases ?? null,
        '购买率': toPercentage(k.purchaseRate ?? null),
        '展示量': k.impressions ?? null,
        '点击量': k.clicks ?? null,
        '商品数': k.products ?? null,
        '需供比': k.supplyDemandRatio ?? null,
        '广告竞品数': k.latest7daysAds ?? null,
        '点击总占比': toPercentage(k.monopolyClickRate ?? null),
        '转化总占比': toPercentage(k.top3ConversionRate ?? null),
        'PPC价格': k.exactPpc ?? null,
        '建议最低竞价': k.minExactPpc ?? null,
        '建议最高竞价': k.maxExactPpc ?? null,
    }
}

export class TaskService {
    async run() {
        const accessToken = await getTenantAccessToken()
        const appToken = LARK_APP_TOKEN
        const taskName = TASK_LIST_TABLE_NAME
        if (!appToken || !taskName) {
            logger.warn('[TASK] 跳过：缺少 BITABLE_APP_TOKEN 或 TASK_LIST_TABLE_NAME')
            return
        }
        const tables = await listTables(accessToken, appToken)
        logger.info(`[TASK] 检测到 ${tables.length} 个数据表`)
        let taskTable = await findTableByName(accessToken, appToken, taskName)
        if (!taskTable) {
            const created = await createTable(accessToken, appToken, taskName, [
                {field_name: 'asin', type: 'Text'},
                {field_name: '最近处理时间', type: 'Text'},
                {field_name: '备注', type: 'Text'}
            ])
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK] 已创建任务列表数据表')
        }
        const taskItems = await listRecords(accessToken, appToken, taskTable.table_id)
        logger.info(`[TASK] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const listTableInfo = await listTables(accessToken, appToken)
        const startTask = taskItems.filter(it=>it.fields?.asin && (!it.fields["最近处理时间"]||dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD")!==todayKey))
        logger.info(`[TASK] 待处理任务数：${startTask.length}`)
        for (const it of startTask) {
            const asin = it.fields?.asin
            const last = it.fields?.['最近处理时间'] as string | undefined
            if (!asin) continue
            if (last && String(last).startsWith(todayKey)) continue
            const childName = bucketName(asin)
            let child = listTableInfo.find((t: any) => t.name === childName) || null
            if (!child) {
                const createdChild = await createTable(accessToken, appToken, childName, getChildTableFields() as any)
                child = {table_id: createdChild.table_id, name: childName}
                logger.info(`[TASK] 已创建子表: ${childName}`)
            }
            try {
                const resp = await this.getAllReverseLookupRecords(asin)
                const dataArr = resp.map(mapKeywordToRecord)
                if (dataArr.length > 0) {
                    const r = await insertRecords(accessToken, appToken, child.table_id, dataArr)
                    logger.info(`[TASK] ${asin} 子表写入：${dataArr.length}`)
                }
                await updateRecord(accessToken, appToken, taskTable.table_id, it.record_id, {'最近处理时间':dayjs().format("YYYY-MM-DD HH:mm:ss")})
                logger.info(`[TASK] 处理 ${asin} 完成`)
            } catch (e: any) {
                console.log("e", e)
                console.log("e", JSON.stringify(e.response.data, null, 2))
                logger.error(`[TASK] 处理 ${asin} 失败：${e?.message || e}`)
            }
        }
    }

    //获取全部反查记录
  private async getAllReverseLookupRecords(asin: string) {
    const svc = BackendDataScalerService.getInstance()
    const allRecords: IKeywordData[] = []
    let pageNum = 1
    const pageSize = 200
    try {
      while (true) {
          logger.info(`[TASK] 反查关键词获取中，ASIN:${asin} 页码:${pageNum}`)
        const resp = await svc.getAsinKeywords({asin, pageSize, pageNum})
        if (resp?.data && resp.data.length > 0) {
          allRecords.push(...resp.data)
          if (resp.data.length < pageSize) {
            break
          }
          pageNum++
        } else {
          break
        }
      }
    }catch (e) {
      console.log("e", e)
        logger.error(`批量反查获取失败`)
    }
    return allRecords
  }
}

