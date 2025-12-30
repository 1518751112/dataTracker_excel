import logger from '@/lib/logger'
import {LARK_FOLDER_TOKEN, TASK_LIST_TABLE_NAME} from '@/config/env'
import {
    createApp,
    createTable,
    ensureFields,
    findTableByName,
    insertRecords,
    listRecords,
    listTables,
    updateRecord
} from '@/services/bitable'
import {BackendDataScalerService, IKeywordData} from '@/services/backend.datascaler'
import {getTenantAccessToken} from '@/services/larkAuth'
import dayjs from "dayjs";
import {BitableType, readAllBitables, writeAllBitables} from "@lib/localData";
import {ProductDetail, ProductResult, Scrapeapi} from "@/services/scrapeapi";

function bucketName(asin: string, d = new Date()) {
    const day = d.getDate()
    const b = Math.ceil(day / 10).toString()
    return `${dayjs(d).format("YYMM")}${b}_${asin}`
}

function getChildTableFields() {
    return [
        {field_name: '日期', type: 'DateTime'},
        {field_name: '关联关键词', type: 'Text'},
        {field_name: '流量占比', type: 'Text'},
        {field_name: '预估周曝光量', type: 'Number'},
        {field_name: '流量词类型', type: 'Text'},
        {field_name: '自然流量占比', type: 'Text'},
        {field_name: '广告流量占比', type: 'Text'},
        {field_name: '自然排名', type: 'Number'},
        {field_name: '自然排名页码', type: 'Text'},
        {field_name: '更新时间', type: 'Text'},
        {field_name: '广告排名', type: 'Text'},
        {field_name: '广告排名页码', type: 'Text'},
        {field_name: 'ABA周排名', type: 'Number'},
        {field_name: '月搜索量', type: 'Number'},
        {field_name: 'SPR', type: 'Number'},
        {field_name: '标题密度', type: 'Number'},
        {field_name: '购买量', type: 'Number'},
        {field_name: '购买率', type: 'Text'},
        {field_name: '展示量', type: 'Number'},
        {field_name: '点击量', type: 'Number'},
        {field_name: '商品数', type: 'Number'},
        {field_name: '需供比', type: 'Number'},
        {field_name: '广告竞品数', type: 'Number'},
        {field_name: '点击总占比', type: 'Text'},
        {field_name: '转化总占比', type: 'Text'},
        {field_name: 'PPC价格', type: 'Number'},
        {field_name: '建议最低竞价', type: 'Number'},
        {field_name: '建议最高竞价', type: 'Number'},
    ]
}

function getChildTableFields2() {
    return [
        {field_name: '追踪日期', type: 'DateTime'},
        {field_name: '关键词', type: 'Text'},
        {field_name: 'ASIN', type: 'Text'},
        {field_name: '站点', type: 'Text'},
        {field_name: '邮编', type: 'Text'},
        {field_name: '自然排名', type: 'Text'},
        {field_name: '是否广告位', type: 'Text'},
        {field_name: '到货时间', type: 'Text'},
        {field_name: '最快到货时间', type: 'Text'},
        {field_name: '星级', type: 'Text'},
        {field_name: '评论数', type: 'Text'},
    ]
}

//转为百分比同时加上%
function toPercentage(value: number | null | undefined) {
    if (value === null || value === undefined) return null
    return (value * 100).toFixed(2) + '%'
}

function mapKeywordToRecord(k: IKeywordData) {
    const nowTime = dayjs().valueOf();
    return {
        '关联关键词': k.keywords,
        '日期': nowTime,
        '流量占比': toPercentage(k.trafficPercentage),
        '预估周曝光量': k.calculatedWeeklySearches ?? null,
        '流量词类型': k.position ?? null,
        '自然流量占比': toPercentage(k.naturalRatio ?? null),
        '广告流量占比': toPercentage(k.adRatio ?? null),
        '自然排名': k.rankPosition?.position ?? k.rankPosition?.index ?? null,
        '自然排名页码': k.rankPosition?`第${k.rankPosition.page}页 ${k.rankPosition.position}/${k.rankPosition.pageSize}`:null,
        '更新时间': k.rankPosition?.updatedTime?`中:${dayjs(k.rankPosition?.updatedTime).format('MM.DD HH:mm')}\n美:${dayjs(k.rankPosition?.updatedTime).add(8, 'hour').format('MM.DD HH:mm')}`:null,
        '广告排名': k.adPosition?k.adPosition.position.toString() : "前3页无排名",
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

function keyListToRecord(keyword:string, asin:string, zipcode:string,site:string,found?:ProductResult,asinInfo?:ProductDetail) {
    const nowTime = dayjs().valueOf();
    return {
        '追踪日期': nowTime,
        '关键词': keyword,
        'ASIN': asin,
        '邮编': zipcode,
        '站点': site,
        '自然排名': found?.nature_rank?.toString()||"无",
        '是否广告位': found?.sponsered=="1"?"是":'',
        '最快到货时间': asinInfo?.delivery?.fastestDelivery,
        '到货时间': asinInfo?.delivery?.deliveryTime,
        '星级': (asinInfo?.star||found?.star)||null,
        '评论数': (asinInfo?.rating||found?.rating)?.replace(/[^\d.]/g, '') || null,
    }
}

export class TaskService {
    async run() {
        const accessToken = await getTenantAccessToken()
        const {taskApp,logs} = await this.init('追踪ASIN维护清单',`${dayjs().format("YYMM01")}_ASIN追踪记录}`);
        const taskAppToken = taskApp?.app_token
        const logAppToken = logs?.app_token
        const taskName = TASK_LIST_TABLE_NAME
        if (!taskAppToken || !logAppToken) {
            logger.warn('[TASK] 跳过：缺少 logAppToken 或 taskAppToken')
            return
        }
        //--------获取任务----------
        let taskTable = await findTableByName(accessToken, taskAppToken, taskName)
        if (!taskTable) {
            const created = await createTable(accessToken, taskAppToken, taskName, [
                {field_name: 'asin', type: 'Text'},
                {field_name: '最近处理时间', type: 'Text'},
                {field_name: '备注', type: 'Text'}
            ])
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK] 已创建任务列表数据表')
        }
        //----------处理任务-----------
        const taskItems = await listRecords(accessToken, taskAppToken, taskTable.table_id)
        logger.info(`[TASK] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const listTableInfo = await listTables(accessToken, logAppToken)
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
                const createdChild = await createTable(accessToken, logAppToken, childName, getChildTableFields() as any)
                child = {table_id: createdChild.table_id, name: childName}
                logger.info(`[TASK] 已创建子表: ${childName}`)
            }else{
                //检测子表字段
                await ensureFields(accessToken, logAppToken, child.table_id, getChildTableFields())
            }

            try {
                const resp = await this.getAllReverseLookupRecords(asin)
                const dataArr = resp.map(mapKeywordToRecord)
                if (dataArr.length > 0) {
                    const r = await insertRecords(accessToken, logAppToken, child.table_id, dataArr)
                    logger.info(`[TASK] ${asin} 子表写入：${dataArr.length}`)
                }
                await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间':dayjs().format("YYYY-MM-DD HH:mm:ss")})
                logger.info(`[TASK] 处理 ${asin} 完成`)
            } catch (e: any) {
                console.log("e", e)
                if(e.response?.data)console.log("e", JSON.stringify(e.response?.data, null, 2))
                logger.error(`[TASK] 处理 ${asin} 失败：${e?.message || e}`)
            }
        }
        logger.info(`[TASK] 本轮任务处理完成:${startTask.length}`)
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

    //初始化系统
    async init(taskName:string,logName:string) {
        if(!LARK_FOLDER_TOKEN){
            logger.error(`[TASK INIT] LARK_FOLDER_TOKEN 未配置，任务无法运行`);
            return {}
        }
        return {
            taskApp: await this.checkAndCreateDocs(BitableType.TASK,taskName),
            logs: await this.checkAndCreateDocs(BitableType.LOG,logName),
        }
    }
    //检测飞书文档并创建
    async checkAndCreateDocs(type:BitableType,name:string) {
        //获取飞书文档列表
        const list = readAllBitables()
        const taskIndex = list.findIndex(it=>it.type==type&&it.status=='active');
        let task = list[taskIndex]
        const accessToken = await getTenantAccessToken()
        let isNewTask = !task;

        if(task){
            //检测任务表是否存在
            try {
                const tables = await listTables(accessToken, task.app_token)
                if(tables.length==0)isNewTask=true
            }catch (e) {
                logger.error(`[TASK INIT] 任务表应用检测失败: ${e}`);
                isNewTask = true;
            }
        }
        if(isNewTask){
            logger.warn(`[TASK INIT] 未找到:${name},开始创建`);
            try {
                task = await createApp(accessToken,name,LARK_FOLDER_TOKEN)
                task.type = type;
                task.status = "active";
                logger.info(`[TASK INIT] 任务表应用创建成功:${name}`);
                if(taskIndex!=-1){
                    list.splice(taskIndex,1)
                }
                list.filter(v=>v.type==type).forEach(v=>{
                    v.status = "inactive"
                })
                list.push(task)
                writeAllBitables(list)
            }catch (e) {
                logger.error(`[TASK INIT] 任务表创建失败: ${e}`);
                return;
            }
        }

        return task;
    }

    //从scrapeapi获取相关数据任务
    async run2(){
        const accessToken = await getTenantAccessToken()
        const {taskApp,logs} = await this.init('追踪ASIN与关键字维护清单','ASIN与关键字追踪记录');
        const taskAppToken = taskApp?.app_token
        const logAppToken = logs?.app_token
        const taskName = "追踪ASIN清单"
        if (!taskAppToken || !logAppToken) {
            logger.warn('[TASK2] 跳过：缺少 logAppToken 或 taskAppToken')
            return
        }
        //--------获取任务----------
        let taskTable = await findTableByName(accessToken, taskAppToken, taskName)
        if (!taskTable) {
            const created = await createTable(accessToken, taskAppToken, taskName, [
                {field_name: '关键词', type: 'Text'},
                {field_name: 'ASIN', type: 'Text'},
                {field_name: '站点', type: 'SingleSelect'},
                {field_name: '邮编', type: 'SingleSelect'},
                {field_name: '最近处理时间', type: 'Text'},
            ])
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK2] 已创建任务列表数据表')
        }
        //----------处理任务-----------
        const taskItems = await listRecords(accessToken, taskAppToken, taskTable.table_id)
        logger.info(`[TASK2] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const startTask = taskItems.filter(it=>it.fields?.ASIN && (!it.fields["最近处理时间"]||dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD")!==todayKey))
        logger.info(`[TASK2] 待处理任务数：${startTask.length}`)
        const listTableInfo = await listTables(accessToken, logAppToken)

        let childName = dayjs().format("YYMM")+"_追踪结果"
        let child = listTableInfo.find((t: any) => t.name === childName) || null
        if (!child) {
            const createdChild = await createTable(accessToken, logAppToken, childName, getChildTableFields2() as any)
            child = {table_id: createdChild.table_id, name: childName}
            logger.info(`[TASK] 已创建子表: ${childName}`)
        }else{
            //检测子表字段
            await ensureFields(accessToken, logAppToken, child.table_id, getChildTableFields2())
        }
        const asinInfoMap:Map<string, ProductDetail> = new Map()
        for (const it of startTask) {
            const asin = it.fields?.ASIN
            const keyword = it.fields["关键词"];
            const zipcode = it.fields["邮编"];
            const site = it.fields["站点"];
            if (!asin||!keyword||!zipcode) continue

            try {
                const resp = await this.getKeywordAsinRank(keyword,asin,site,zipcode,asinInfoMap)
                if (resp) {
                    const r = await insertRecords(accessToken, logAppToken, child.table_id, [resp])
                    logger.info(`[TASK2] ${asin} 子表写入`)
                }
                await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间':dayjs().format("YYYY-MM-DD HH:mm:ss")})
                logger.info(`[TASK2] 处理 ${asin} 完成`)
            } catch (e: any) {
                console.log("e", e)
                if(e.response?.data)console.log("e", JSON.stringify(e.response?.data, null, 2))
                logger.error(`[TASK2] 处理 ${asin} 失败：${e?.message || e}`)
            }
        }
        logger.info(`[TASK2] 本轮任务处理完成:${startTask.length}`)
    }

    //查询关键字中的ASIN排名数据
    private async getKeywordAsinRank(keyword: string,asin:string,site:string, zipcode: string,asinInfoMap:Map<string, ProductDetail>) {
        //默认只查询3页
        const count = 3;
        const instance = Scrapeapi.getInstance();
        let found: ProductResult | null = null;
        for (let i = 0; i < count; i++) {
            logger.info(`[TASK2] 关键字查询ASIN排名中，关键词:${keyword} ASIN:${asin} 页码:${i+1}`)
            const resp = await instance.keywordSearchAsin(keyword,zipcode,i+1);
            if(resp && resp.results && resp.results.length>0){
                const temp = resp.results.find(r=>r.asin===asin);
                if(temp){
                    logger.debug("temp",temp)
                    found = temp;
                    break;
                }
            }
        }
        const key = `${asin}_${zipcode}`;
        let asinInfo = asinInfoMap.get(key);
        if(!asinInfo){
            asinInfo = await instance.getProductByAsin(asin, zipcode);
            asinInfoMap.set(key,asinInfo)
        }
        return keyListToRecord(keyword,asin,zipcode,site,found,asinInfo)
    }

}

