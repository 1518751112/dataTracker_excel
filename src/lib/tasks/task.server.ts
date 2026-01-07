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
import {FieldSpec} from "@/types/bitable";

const ChildTableFieldsKey2 = {
    "追踪日期": {type: "DateTime"},
    "关键词": {type: "Text"},
    "ASIN": {type: "Text"},
    "站点": {type: "Text"},
    "邮编": {type: "Text"},
    "自然排名": {type: "Number"},
    "广告排名": {type: "Number"},
    "价格": {type: "Text"},

}
type ChildTableFieldsKey2Type = Record<keyof typeof ChildTableFieldsKey2, any>

const ThisProduct = {
    "追踪日期": {type: "DateTime"},
    "ASIN": {type: "Text"},
    "站点": {type: "Text"},
    "邮编": {type: "Text"},
    "到货时间": {type: "Text"},
    "最快到货时间": {type: "Text"},
    "星级": {type: "Text"},
    "评论数": {type: "Text"},
    "BSR排名（全）": {type: "Text"},
    "BSR大类名称": {type: "Text"},
    "BSR大类排名": {type: "Text"},
    "BSR小类（一）名称": {type: "Text"},
    "BSR小类（一）排名": {type: "Text"},
    "BSR小类（二）名称": {type: "Text"},
    "BSR小类（二）排名": {type: "Text"},
}
type ThisProductType = Record<keyof typeof ThisProduct, any>
//任务清单表
const TaskTableFields2 = {
    "本品ASIN": {type: "Text"},
    "Category": {type: "SingleSelect"},
    "追踪关键词": {type: "Text"},
    "竞品ASIN": {type: "Text"},
    "站点": {type: "MultiSelect"},
    "最近处理时间": {type: "Text"},
}
type TaskTableFields2Type = Record<keyof typeof TaskTableFields2, any>

function bucketName(asin: string, d = new Date()) {
    const day = d.getDate()
    const b = Math.ceil(day / 10).toString()
    return `${dayjs(d).format("YYMM")}${b}_${asin}`
}

function getChildTableFields() {
    return [
        {field_name: '日期', type: 'DateTime'},
        {field_name: '关联关键词', type: 'Text'},
        {field_name: '流量占比', type: 'Number', property: {formatter: "0.00%"}},
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

    return Object.keys(ChildTableFieldsKey2).map(key => {
        return {field_name: key, ...ChildTableFieldsKey2[key]}
    }) as FieldSpec[]
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
        '流量占比': Number(((k.trafficPercentage || 0) * 100).toFixed(2)),
        '预估周曝光量': k.calculatedWeeklySearches ?? null,
        '流量词类型': k.position ?? null,
        '自然流量占比': toPercentage(k.naturalRatio ?? null),
        '广告流量占比': toPercentage(k.adRatio ?? null),
        '自然排名': k.rankPosition?.position ?? k.rankPosition?.index ?? null,
        '自然排名页码': k.rankPosition ? `第${k.rankPosition.page}页 ${k.rankPosition.position}/${k.rankPosition.pageSize}` : null,
        '更新时间': k.rankPosition?.updatedTime ? `中:${dayjs(k.rankPosition?.updatedTime).format('MM.DD HH:mm')}\n美:${dayjs(k.rankPosition?.updatedTime).add(8, 'hour').format('MM.DD HH:mm')}` : null,
        '广告排名': k.adPosition ? k.adPosition.position.toString() : "前3页无排名",
        '广告排名页码': k.adPosition ? `第${k.adPosition.page}页 ${k.adPosition.position}/${k.adPosition.pageSize}` : null,
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

//关键字排名处理
function keyListToRecord(keyword: string, asin: string, zipcode: string, site: string, found?: ProductResult): ChildTableFieldsKey2Type {
    const nowTime = dayjs().valueOf();
    return {
        '追踪日期': nowTime,
        '关键词': keyword,
        'ASIN': asin,
        '邮编': zipcode,
        '站点': site,
        '自然排名': Number(found?.nature_rank || 0)||null,
        '广告排名': Number(found?.spRank || 0)||null,
        '价格': found?.price || null,
    }
}

//BSR分割逻辑
function splitCategoryString(BSR: string | undefined | null): string[] {
    if (!BSR) return [];
    let categoryParts = BSR.split('#')

    // Check effective parts
    const validHashParts = categoryParts.filter(p => p && p.trim().length > 0)

    // If # split failed (only 1 valid part)
    if (validHashParts.length <= 1) {
        // Try Nr. (German)
        const nrParts = BSR.split('Nr.')
        const validNrParts = nrParts.filter(p => p && p.trim().length > 0)
        if (validNrParts.length > 1) return nrParts;

        // Try n. (Italian) - strict "n. " to avoid splitting words ending in n.
        const nDotParts = BSR.split(/n\.\s/i)
        const validNDotParts = nDotParts.filter(p => p && p.trim().length > 0)
        if (validNDotParts.length > 1) return nDotParts;

        // Try nº / Nº (Spanish/Portuguese)
        const noParts = BSR.split(/nº\s*/i)
        const validNoParts = noParts.filter(p => p && p.trim().length > 0)
        if (validNoParts.length > 1) return noParts;

        // Fallback to )
        const parenParts = BSR.split(')')
        const validParenParts = parenParts.filter(p => p && p.trim().length > 0)
        if (validParenParts.length > 1) return parenParts;
    }

    return categoryParts;
}

//BSR单项解析逻辑
function parseCategoryString(str: string | undefined | null) {
    if (!str) return { name: null, rank: null }
    str = str.trim()

    // Pre-processing
    str = str.replace(/^[\(（]/, '').trim() // Remove leading parens
    str = str.replace(/^(Nr\.|n\.|nº|Nº)\s*/i, '').trim() // Remove rank prefixes
    str = str.replace(' ', '').replace(/^#/, '').trim() // Remove leading hash

    if(str.includes("(") && !str.includes(")")) str = str+")"

    // Japanese: Name - Rank位
    const jpMatch = str.match(/(.+)\s+-\s+([\d,]+)位/)
    if (jpMatch) {
         let name = jpMatch[1].trim()
         name = name.replace(/[\(（](See|Siehe|Ver|Visualizza|Conheça|売れ筋ランキングを見る|شاهد).*[\)）]/i, '').trim()
         return {
             rank: jpMatch[2].replace(/[,.]/g, ''),
             name: name
         }
    }

    // Standard: Rank in Name
    // Added Arabic digit support in matching range
    const stdMatch = str.match(/^([\d.,\u0660-\u0669\u066C]+)\s+(in|en|em|في)\s+(.+)/i)
    if (stdMatch) {
        let name = stdMatch[3]
        name = name.replace(/[\(（](See|Siehe|Ver|Visualizza|Conheça|売れ筋ランキングを見る|شاهد).*[\)）]/i, '').trim()
        let rankStr = stdMatch[1].replace(/[,.\u066C]/g, '') // Remove separators
        // Convert Arabic digits
        rankStr = rankStr.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())

        return {
            rank: rankStr,
            name: name
        }
    }

    // "See Top ... in Name" (Rank is null)
    const inMatch = str.match(/\s+(in|en|em|في)\s+(.+)/i)
    if (inMatch) {
         let name = inMatch[2]
         name = name.replace(/[\(（](See|Siehe|Ver|Visualizza|Conheça|売れ筋ランキングを見る|شاهد).*[\)）]/i, '').trim()
         return {
             rank: null,
             name: name
         }
    }

    return { name: str, rank: null }
}

//本品相关信息
function thisProductToRecord(asin:string,zipcode: string, site: string, asinInfo: ProductDetail):ThisProductType {
    const nowTime = dayjs().valueOf();
    const attributes = asinInfo?.attributes || []
    const BSR = attributes.find(item => ["meilleures ventes","Best","Amazon 売れ筋ランキング","Clasificación","الأفضل مبيعاً","Ranking dos mais vendidos"].find(key=>item.key.includes(key)))?.value || null
    const {mainCat,subCat1,subCat2} = parseBSR(BSR)

    return {
        '追踪日期': nowTime,
        'ASIN': asin,
        '站点': site,
        '邮编': zipcode,
        '到货时间': asinInfo?.delivery?.deliveryTime,
        '最快到货时间': asinInfo?.delivery?.fastestDelivery,
        '星级': (asinInfo?.star) || null,
        '评论数': (asinInfo?.rating)?.replace(/[^\d.]/g, '') || null,
        'BSR排名（全）': BSR,
        "BSR大类名称": mainCat.name,
        "BSR大类排名": Number(mainCat.rank||0)||null,
        "BSR小类（一）名称": subCat1.name,
        "BSR小类（一）排名": Number(subCat1.rank||0)||null,
        "BSR小类（二）名称": subCat2.name,
        "BSR小类（二）排名": Number(subCat2.rank||0)||null,
    }
}

function parseBSR(BSR?:string){
    const categoryParts = splitCategoryString(BSR)

    let mainCatStr = ''
    let subCat1Str = ''
    let subCat2Str = ''

    if (categoryParts.length > 0) {
        // 如果第一个没有数据说明索引1为第1个数据，反之索引0是
        const startIndex = (categoryParts[0] && categoryParts[0].trim()) ? 0 : 1
        mainCatStr = categoryParts[startIndex]
        subCat1Str = categoryParts[startIndex + 1]
        subCat2Str = categoryParts[startIndex + 2]
    }

    const mainCat = parseCategoryString(mainCatStr)
    const subCat1 = parseCategoryString(subCat1Str)
    const subCat2 = parseCategoryString(subCat2Str)
    return {
        mainCat,
        subCat1,
        subCat2,
    }
}

export class TaskService {
    async run() {
        const accessToken = await getTenantAccessToken()
        const {taskApp, logs} = await this.init('追踪ASIN维护清单', `${dayjs().format("YYMM01")}_ASIN追踪记录}`);
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
        const startTask = taskItems.filter(it => it.fields?.asin && (!it.fields["最近处理时间"] || dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD") !== todayKey))
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
            } else {
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
                await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间': dayjs().format("YYYY-MM-DD HH:mm:ss")})
                logger.info(`[TASK] 处理 ${asin} 完成`)
            } catch (e: any) {
                console.log("e", e)
                if (e.response?.data) console.log("e", JSON.stringify(e.response?.data, null, 2))
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
        } catch (e) {
            console.log("e", e)
            logger.error(`批量反查获取失败`)
        }
        //过滤重复关键字数据
        const uniqueMap = new Map<string, IKeywordData>()
        for (const record of allRecords) {
            if (!uniqueMap.has(record.keywords)) {
                uniqueMap.set(record.keywords, record)
            }
        }
        return Array.from(uniqueMap.values())
    }

    //初始化系统
    async init(taskName: string, logName: string) {
        if (!LARK_FOLDER_TOKEN) {
            logger.error(`[TASK INIT] LARK_FOLDER_TOKEN 未配置，任务无法运行`);
            return {}
        }
        return {
            taskApp: await this.checkAndCreateDocs(BitableType.TASK, taskName),
            logs: await this.checkAndCreateDocs(BitableType.LOG, logName),
        }
    }

    //检测飞书文档并创建
    async checkAndCreateDocs(type: BitableType, name: string) {
        //获取飞书文档列表
        const list = readAllBitables()
        const taskIndex = list.findIndex(it => it.type == type && it.status == 'active');
        let task = list[taskIndex]
        const accessToken = await getTenantAccessToken()
        let isNewTask = !task;

        if (task) {
            //检测任务表是否存在
            try {
                const tables = await listTables(accessToken, task.app_token)
                if (tables.length == 0) isNewTask = true
            } catch (e) {
                logger.error(`[TASK INIT] 任务表应用检测失败: ${e}`);
                isNewTask = true;
            }
        }
        if (isNewTask) {
            logger.warn(`[TASK INIT] 未找到:${name},开始创建`);
            try {
                task = await createApp(accessToken, name, LARK_FOLDER_TOKEN)
                task.type = type;
                task.status = "active";
                logger.info(`[TASK INIT] 任务表应用创建成功:${name}`);
                if (taskIndex != -1) {
                    list.splice(taskIndex, 1)
                }
                list.filter(v => v.type == type).forEach(v => {
                    v.status = "inactive"
                })
                list.push(task)
                writeAllBitables(list)
            } catch (e) {
                logger.error(`[TASK INIT] 任务表创建失败: ${e}`);
                return;
            }
        }

        return task;
    }

    //从scrapeapi获取相关数据任务
    async run2() {
        const accessToken = await getTenantAccessToken()
        const {taskApp, logs} = await this.init('吸尘器客户追踪ASIN清单', '吸尘器客户排名及发货时间监控结果(Demo)');
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
            const created = await createTable(accessToken, taskAppToken, taskName, Object.keys(TaskTableFields2).map(k => ({field_name: k, ...TaskTableFields2[k]})))
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK2] 已创建任务列表数据表')
        }
        //----------处理任务-----------
        const taskItems = await listRecords<TaskTableFields2Type>(accessToken, taskAppToken, taskTable.table_id)
        logger.info(`[TASK2] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const startTask = taskItems.filter(it => it.fields["本品ASIN"] && (!it.fields["最近处理时间"] || dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD") !== todayKey))
        logger.info(`[TASK2] 待处理任务数：${startTask.length}`)
        const listTableInfo = await listTables(accessToken, logAppToken)

        const childName = dayjs().format("YYMM") + "_关键词排名"
        const child = await this.ensureTable(accessToken, logAppToken, childName,listTableInfo, getChildTableFields2());
        const thisProductTable = await findTableByName(accessToken, logAppToken, "发货时间及BSR排名")

        const asinInfoMap: Map<string, ProductDetail> = new Map()
        for (const it of startTask) {
            const asin = it.fields["本品ASIN"] as string
            const keyword = (it.fields["追踪关键词"]?.split("\n") || []) as string[];
            const sites = (it.fields["站点"]?.map(v => {
                const arr = v.split("-")
                return {
                    zipcode: arr[1],
                    name: arr[0]
                }
            }) || []) as [];
            const competitorsASINs = (it.fields["竞品ASIN"]?.split("\n") || []) as string[];
            if (!asin || !keyword || !sites.length) continue

            try {
                const {keywordRank, thisProduct} = await this.getKeywordAsinRank(keyword, asin, sites, asinInfoMap, competitorsASINs)
                if (keywordRank.length) {
                     await insertRecords(accessToken, logAppToken, child.table_id, keywordRank)
                    logger.info(`[TASK2] 子表写入:${keywordRank.length}`)
                }
                if (thisProduct.length) {
                    await insertRecords(accessToken, logAppToken, thisProductTable.table_id, thisProduct)
                    logger.info(`[TASK2] ${thisProduct.map(v=>v.ASIN).join(',')} BSR排名表写入:${thisProduct.length}`)
                }
                await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间': dayjs().format("YYYY-MM-DD HH:mm:ss")})
                logger.info(`[TASK2] 处理 ${asin} 完成`)
            } catch (e: any) {
                console.log("e", e)
                if (e.response?.data) console.log("e", JSON.stringify(e.response?.data, null, 2))
                logger.error(`[TASK2] 处理 ${asin} 失败：${e?.message || e}`)
            }
        }
        logger.info(`[TASK2] 本轮任务处理完成:${startTask.length}`)
    }

    //查询关键字中的ASIN排名数据
    private async getKeywordAsinRank(keywords: string[], asin: string, sites: {
        zipcode: string,
        name: string
    }[], asinInfoMap: Map<string, ProductDetail>, CompetitorsASINs: string[]): Promise<{keywordRank:ChildTableFieldsKey2Type[], thisProduct:ThisProductType[]}> {
        //默认只查询3页
        const count = 3;
        const instance = Scrapeapi.getInstance();
        const records: ChildTableFieldsKey2Type[] = [];
        const asinList = [asin, ...CompetitorsASINs]
        const thisProduct:ThisProductType[] = []
        await Promise.all(sites.map(async site => {
            //站点
            const {zipcode, name} = site
            for (let j = 0; j < keywords.length; j++) {
                //关键字
                const keyword = keywords[j]
                const founds: ProductResult[] = [];
                for (let i = 0; i < count; i++) {
                    // logger.info(`[TASK2] 关键字查询ASIN排名中，关键词:${keyword} 本品ASIN:${asin} 邮编：${zipcode} 页码:${i + 1}`)
                    const resp = await instance.keywordSearchAsin(keyword, zipcode, i + 1);
                    if (resp && resp.results && resp.results.length > 0) {
                        const temp = resp.results.find(r => asinList.includes(r.asin));
                        if (temp) {
                            // logger.debug("temp",temp)
                            founds.push(temp)
                        }
                        if (founds.length >= CompetitorsASINs.length + 1) {
                            break;
                        }
                    }
                }
                logger.debug(`[TASK2] 关键字查询ASIN排名中，关键词:${keyword} 本品ASIN:${asin} 邮编：${zipcode} 找到ASIN数:${founds.length}`)
                records.push(...asinList.map(tempAsin => {
                    const found = founds.find(r => r.asin === tempAsin);
                    return keyListToRecord(keyword, tempAsin, zipcode, name, found)
                }))


            }

            //本品信息
            const key = `${asin}_${zipcode}`;
            let asinInfo = asinInfoMap.get(key);
            if (!asinInfo) {
                asinInfo = await instance.getProductByAsin(asin, zipcode);
                asinInfoMap.set(key, asinInfo)
            }
            thisProduct.push(thisProductToRecord(asin,zipcode, name, asinInfo))
        }))

        return {
            keywordRank: records,
            thisProduct
        }

    }

    //查询或创建数据表
    private async ensureTable(accessToken: string, logAppToken: string, tableName: string,listTableInfo:any[], fields: FieldSpec[]) {
        let child = listTableInfo.find((t: any) => t.name === tableName) || null
        if (!child) {
            const createdChild = await createTable(accessToken, logAppToken, tableName, fields)
            child = {table_id: createdChild.table_id, name: tableName}
            logger.info(`[TASK] 已创建子表: ${tableName}`)
        } else {
            //检测子表字段
            await ensureFields(accessToken, logAppToken, child.table_id, fields)
        }
        return child
    }

}

