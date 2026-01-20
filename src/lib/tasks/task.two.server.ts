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
import {BitableData, BitableType} from "@lib/localData";
import {BestsellerProduct, ProductDetail, ProductResult, Scrapeapi} from "@/services/scrapeapi";
import {FieldSpec} from "@/types/bitable";
import {TaskTool} from "@lib/tasks/task.tool";

//追踪类目清单
const CategoryListFieldsKey = {
    "任务编号": {type: "AutoNumber"},
    "追踪站点与邮编": {type: "MultiSelect"},
    "追踪类目链接": {type: "Text"},
    "最近处理时间": {type: "Text"},
}
type CategoryListFieldsKeyType = Record<keyof typeof CategoryListFieldsKey, any>

//关键词追踪清单
const ASINListFieldsKey = {
    "任务编号": {type: "AutoNumber"},
    "站点与邮编": {type: "MultiSelect"},
    "追踪关键词": {type: "Text"},
    "本品ASIN": {type: "Text"},
    "竞品ASIN": {type: "Text"},
    "最近处理时间": {type: "Text"},
}
type ASINListFieldsKeyType = Record<keyof typeof ASINListFieldsKey, any>

//追踪ASIN清单
const ASINListFieldsKey2 = {
    "任务编号": {type: "AutoNumber"},
    "追踪站点与邮编": {type: "MultiSelect"},
    "追踪ASIN": {type: "Text"},
    "最近处理时间": {type: "Text"},
}
type ASINListFieldsKey2Type = Record<keyof typeof ASINListFieldsKey2, any>

const ThisProductRes = {
    "采集时间": {type: "DateTime"},
    "站点与邮编": {type: "SingleSelect"},
    "ASIN": {type: "Text"},
    "ASIN标题": {type: "Text"},
    "星级": {type: "Text"},
    "评论数量": {type: "Text"},
    "商品价格": {type: "Text"},
    "划线价格": {type: "Text"},
    "Color": {type: "Text"},
    "Size": {type: "Text"},
    "是否有BuyBox": {type: "SingleSelect"},
    "Seller": {type: "Text"},
    "Shipper": {type: "Text"},
    "跟卖数量": {type: "Number"},
    "跟卖卖家": {type: "Text"},
    "库存情况": {type: "Text"},
    "到货时间": {type: "Text"},
    "最快到货时间": {type: "Text"},
    "BSR Rank": {type: "Text"},
    "AC标识": {type: "SingleSelect"},
}
type ThisProductResType = Record<keyof typeof ThisProductRes, any>

const BestsellerListRes = {
    "采集时间": {type: "DateTime"},
    "榜单名称": {type: "Text"},
    "ASIN": {type: "Text"},
    "ASIN标题": {type: "Text"},
    "站点与邮编": {type: "SingleSelect"},
    "榜单排名": {type: "Number"},
    "商品价格": {type: "Text"},
    "星级": {type: "Text"},
    "评论数量": {type: "Text"},
    "本次新增": {type: "Text"},
    "类目名称": {type: "Text"},
    "首次发售日期": {type: "Text"},
    "最近一个月销量": {type: "Text"},
    "Customers Say": {type: "Text"},
    "Customers say Keywords": {type: "Text"},
    "customers reviews": {type: "Text"},
}
type BestsellerListResType = Record<keyof typeof BestsellerListRes, any>

const KeywordsListRes = {
    "采集时间": {type: "DateTime"},
    "关键词": {type: "Text"},
    "站点与邮编": {type: "SingleSelect"},
    "ASIN": {type: "Text"},
    "ASIN标题": {type: "Text"},
    "星级": {type: "Number"},
    "自然排名": {type: "Number"},
    "广告排名": {type: "Number"},
    "商品价格": {type: "Text"},
}
type KeywordsListResType = Record<keyof typeof KeywordsListRes, any>



function getTableFields(obj: Record<string, any>) {

    return Object.keys(obj).map(key => {
        return {field_name: key, ...obj[key]}
    }) as FieldSpec[]
}

function sellersRankToRecord(item:BestsellerProduct,found?: ProductDetail,site?: {zipcode:string,name:string}): BestsellerListResType {
    const nowTime = dayjs().valueOf();
    const star = item.star?.match(/^[\d.]+/)?.[0] || null;
    const aiReviews = found?.aiReviewsSummary || found?.aiReviews;
    let customerSay, customerKeywords,customerReviews;
    if (aiReviews) {
        // Customers
        const aiReviewsObj = aiReviews;
        const say = aiReviewsObj.content;

        // 获取关键词，用逗号连接
        const keywords = aiReviewsObj.items
            .map(item => item.label)
            .join(',');

        // 获取评论，格式化为"标签: 内容"
        const reviews = aiReviewsObj.items
            .map(item => {
                const content = item.contents.join(''); // 将contents数组连接成字符串
                return `${item.label}: \n${content}`;
            })
            .join('\n\n'); // 用两个换行分隔不同项

        customerSay = say;
        customerKeywords = keywords;
        customerReviews = reviews;
    }
    return {
        "采集时间": nowTime,
        "榜单名称": "amzBestSellers",
        "ASIN": item.asin,
        "ASIN标题": item.title,
        "站点与邮编": `${site?.name || ""} - ${site?.zipcode || ""}`,
        "榜单排名": Number(item.rank),
        "商品价格": item.price||found?.price,
        "星级": star?Number(star):null,
        "评论数量": found?.rating?.replace(/[^\d.]/g, '') || item.rating,
        "本次新增": null,
        "类目名称": found?.category_name,
        "首次发售日期": found?.first_date,
        "最近一个月销量": found?.sales,
        "Customers Say": customerSay,
        "Customers say Keywords": customerKeywords,
        "customers reviews": customerReviews,
    }
}

//关键字排名处理
function keyListToRecord(keyword: string, asin: string, site: {zipcode:string,name:string}, found?: ProductResult,nowTime?:number): KeywordsListResType {
    nowTime = nowTime||dayjs().valueOf();
    const star = found?.star?.match(/^[\d.]+/)?.[0] || null;
    return {
        '采集时间': nowTime,
        '关键词': keyword,
        'ASIN标题': found?.title || null,
        'ASIN': asin,
        "站点与邮编": `${site?.name || ""} - ${site?.zipcode || ""}`,
        '星级': star?Number(star):null,
        '自然排名': Number(found?.nature_rank || 0)||null,
        '广告排名': Number(found?.spRank || 0)||null,
        '商品价格': found?.price || null,
    }
}

//本品相关信息
function thisProductToRecord(asin:string,asinInfo: ProductDetail,site:{zipcode:string,name:string},nowTime:number):ThisProductResType {
    nowTime = nowTime||dayjs().valueOf();
    const attributes = asinInfo?.attributes || []
    const BSR = attributes.find(item => ["meilleures ventes","Best","Amazon 売れ筋ランキング","Clasificación","الأفضل مبيعاً","Ranking dos mais vendidos"].find(key=>item.key.includes(key)))?.value || null
    let followSellerNum:string|number = asinInfo?.followSeller?.match(/\d/)?.[0];
    if(followSellerNum){
        followSellerNum = Number(followSellerNum)-1
    }
    return {
        '采集时间': nowTime,
        "站点与邮编": `${site?.name || ""} - ${site?.zipcode || ""}`,
        'ASIN': asin,
        'ASIN标题': asinInfo?.title || null,
        '商品价格': asinInfo?.price || null,
        '划线价格': asinInfo?.strikethroughPrice?.value || null,
        "Color": asinInfo?.color,
        "Size": asinInfo?.size,
        '是否有BuyBox': asinInfo?.has_cart?.toString(),
        '跟卖数量': followSellerNum,
        '跟卖卖家': null,
        "Seller": asinInfo?.seller||null,
        "Shipper": asinInfo?.shipper||null,
        '库存情况': asinInfo?.inStock || null,
        '到货时间': asinInfo?.delivery?.deliveryTime,
        '最快到货时间': asinInfo?.delivery?.fastestDelivery,
        '星级': asinInfo?.star?Number((asinInfo?.star)): null,
        '评论数量': asinInfo?.rating?Number((asinInfo?.rating)?.replace(/[^\d.]/g, '')) : null,
        "BSR Rank": BSR,
        "AC标识": asinInfo?.acBadge?"有":"无",
    }
}

const seep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const listingsName = "数据追踪清单";
const dataName = "数据追踪结果";

export class TaskTwoService {
    private isInit = false;
    //追踪ASIN清单任务
    async runASINListTask() {
        const accessToken = await getTenantAccessToken()
        const {taskApp, logs} = await this.init(listingsName, dataName);
        const taskAppToken = taskApp?.app_token
        const logAppToken = logs?.app_token
        if (!taskAppToken || !logAppToken) {
            logger.warn('[TASK ASIN清单任务] 跳过：缺少 logAppToken 或 taskAppToken')
            return
        }
        //--------获取任务----------
        //asin清单
        const taskName = "关键词排名追踪清单"
        let taskTable = await findTableByName(accessToken, taskAppToken, taskName)
        if (!taskTable) {
            const created = await createTable(accessToken, taskAppToken, taskName, getTableFields(ASINListFieldsKey))
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK] 已创建任务列表数据表')
        }
        //----------处理任务-----------
        const taskItems = await listRecords<ASINListFieldsKeyType>(accessToken, taskAppToken, taskTable.table_id)
        logger.info(`[TASK ASIN清单任务] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const startTask = taskItems.filter(it => it.fields["本品ASIN"] && (!it.fields["最近处理时间"] || dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD") !== todayKey))
        logger.info(`[TASK ASIN清单任务] 待处理任务数：${startTask.length}`)

        const listTableInfo = await listTables(accessToken, logAppToken)
        const child = await TaskTool.ensureTable(accessToken, logAppToken, "关键词排名追踪",listTableInfo, getTableFields(KeywordsListRes));
        // const thisProductTable = await TaskTool.ensureTable(accessToken, logAppToken, "本品监控",listTableInfo, getTableFields(ThisProductRes));

        const asinInfoMap: Map<string, ProductDetail> = new Map()
        const nowTime = Date.now()
        for (const it of startTask) {
            const asins = (it.fields["本品ASIN"]?.split("\n") || []) as string[];
            const keyword = (it.fields["追踪关键词"]?.split("\n") || []) as string[];
            const sites = (it.fields["站点与邮编"]?.map(v => {
                const arr = v.split("-")
                return {
                    zipcode: arr[1],
                    name: arr[0]
                }
            }) || []) as [];
            const competitorsASINs = (it.fields["竞品ASIN"]?.split("\n") || []) as string[];
            if (!asins.length || !keyword.length || !sites.length) continue

            try {
                const {keywordRank} = await this.getKeywordAsinRank(keyword, asins, sites, asinInfoMap, competitorsASINs,nowTime)
                if (keywordRank.length) {
                    await insertRecords(accessToken, logAppToken, child.table_id, keywordRank)
                    logger.info(`[TASK2] 子表写入:${keywordRank.length}`)
                }
                await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间': dayjs().format("YYYY-MM-DD HH:mm:ss")})
                logger.info(`[TASK2] 处理 ${asins.join(',')} 完成`)
            } catch (e: any) {
                console.log("e", e)
                if (e.response?.data) console.log("e", JSON.stringify(e.response?.data, null, 2))
                logger.error(`[TASK2] 处理 ${asins.join(',')} 失败：${e?.message || e}`)
            }
        }
    }

    //畅销榜排名任务
    async runTopSellersRankTask() {
        const accessToken = await getTenantAccessToken()
        const {taskApp, logs} = await this.init(listingsName, dataName);
        const taskAppToken = taskApp?.app_token
        const logAppToken = logs?.app_token
        if (!taskAppToken || !logAppToken) {
            logger.warn('[TASK ASIN清单任务] 跳过：缺少 logAppToken 或 taskAppToken')
            return
        }
        //--------获取任务----------
        //asin清单
        const taskName = "榜单类目清单"
        let taskTable = await findTableByName(accessToken, taskAppToken, taskName)
        if (!taskTable) {
            const created = await createTable(accessToken, taskAppToken, taskName, getTableFields(CategoryListFieldsKey))
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK] 已创建任务列表数据表')
        }
        //----------处理任务-----------
        const taskItems = await listRecords<CategoryListFieldsKeyType>(accessToken, taskAppToken, taskTable.table_id)
        logger.info(`[TASK 畅销榜排名] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const startTask = taskItems.filter(it => it.fields["追踪类目链接"] && (!it.fields["最近处理时间"] || dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD") !== todayKey))
        logger.info(`[TASK 畅销榜排名] 待处理任务数：${startTask.length}`)

        const listTableInfo = await listTables(accessToken, logAppToken)
        const child = await TaskTool.ensureTable(accessToken, logAppToken, "热卖榜追踪",listTableInfo, getTableFields(BestsellerListRes));

        for (let i = 0; i < startTask.length; i++) {
            const it = startTask[i]
            const categoryUrl = it.fields["追踪类目链接"]?.trim() || ""
            const sites = (it.fields["追踪站点与邮编"]?.map(v => {
                const arr = v.split("-")
                return {
                    zipcode: arr[1],
                    name: arr[0]
                }
            }) || []) as [];
            if (!categoryUrl) continue

            const sellersRank = await this.handleTopSellersRank(categoryUrl, sites)
            if (sellersRank.length) {
                await insertRecords(accessToken, logAppToken, child.table_id, sellersRank)
                logger.info(`[TASK 畅销榜排名] 子表写入:${sellersRank.length}`)
            }

            await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间': dayjs().format("YYYY-MM-DD HH:mm:ss")})
            logger.info(`[TASK 畅销榜排名] 处理索引 ${i} 完成`)
        }

    }



    //asin清单详情任务
    public async runAsinDetail() {
        const accessToken = await getTenantAccessToken()
        const {taskApp, logs} = await this.init(listingsName, dataName);
        const taskAppToken = taskApp?.app_token
        const logAppToken = logs?.app_token
        if (!taskAppToken || !logAppToken) {
            logger.warn('[TASK asin清单详情] 跳过：缺少 logAppToken 或 taskAppToken')
            return
        }
        //--------获取任务----------
        //asin清单
        const taskName = "追踪ASIN清单"
        let taskTable = await findTableByName(accessToken, taskAppToken, taskName)
        if (!taskTable) {
            const created = await createTable(accessToken, taskAppToken, taskName, getTableFields(ASINListFieldsKey2))
            taskTable = {table_id: created.table_id, name: taskName}
            logger.info('[TASK] 已创建任务列表数据表')
        }
        //----------处理任务-----------
        const taskItems = await listRecords<ASINListFieldsKey2Type>(accessToken, taskAppToken, taskTable.table_id)
        logger.info(`[TASK asin清单详情] 任务列表记录数：${taskItems.length}`)
        const todayKey = dayjs().format("YYYY-MM-DD")
        const startTask = taskItems.filter(it => it.fields["追踪ASIN"] && (!it.fields["最近处理时间"] || dayjs(it.fields["最近处理时间"]).format("YYYY-MM-DD") !== todayKey))
        logger.info(`[TASK asin清单详情] 待处理任务数：${startTask.length}`)

        const listTableInfo = await listTables(accessToken, logAppToken)
        const child = await TaskTool.ensureTable(accessToken, logAppToken, "ASIN追踪",listTableInfo, getTableFields(ThisProductRes));

        const asinInfoMap: Map<string, ProductDetail> = new Map();
        const asinFollowMap: Map<string, number> = new Map();
        const nowTime = Date.now()
        for (let i = 0; i < startTask.length; i++) {
            const it = startTask[i]
            const asins = (it.fields["追踪ASIN"]?.split("\n") || []) as string[];
            const sites = (it.fields["追踪站点与邮编"]?.map(v => {
                const arr = v.split("-")
                return {
                    zipcode: arr[1],
                    name: arr[0]
                }
            }) || []) as [];
            if (!asins.length || !sites.length) continue

            const sellersRank = await this.handleAsinDetail(asins, sites,asinFollowMap,asinInfoMap,nowTime)
            if (sellersRank.length) {
                await insertRecords(accessToken, logAppToken, child.table_id, sellersRank)
                logger.info(`[TASK asin清单详情] 子表写入:${sellersRank.length}`)
            }

            await updateRecord(accessToken, taskAppToken, taskTable.table_id, it.record_id, {'最近处理时间': dayjs().format("YYYY-MM-DD HH:mm:ss")})
            logger.info(`[TASK asin清单详情] 处理索引 ${i} 完成`)
        }
    }

    //处理ASIN清单详情
    private async handleAsinDetail(asins: string[], sites: {zipcode:string,name:string}[],asinFollowMap:Map<string,number>, asinInfoMap: Map<string, ProductDetail>,nowTime:number) {
        const instance = Scrapeapi.getInstance();
        const thisProduct:ThisProductResType[] = []
        logger.info(`[TASK asin清单详情] 开始获取详情:${asins.join(',')}`)
        for (let i = 0; i < sites.length; i++) {
            const zipcode = sites[i].zipcode

            for (let j = 0; j <asins.length ; j++) {
                const asin = asins[j]
                const key = `${asin}_${zipcode}`;
                let asinInfo = asinInfoMap.get(key);
                if (!asinInfo) {
                    asinInfo = await instance.getProductByAsin(asin, zipcode);
                    asinInfoMap.set(key, asinInfo)
                }
                thisProduct.push(thisProductToRecord(asin, asinInfo,sites[i],nowTime))
            }

        }

        return thisProduct
    }

    //处理热卖榜链接处理
    private async handleTopSellersRank(url:string,sites:{zipcode:string,name:string}[]) {
        //通过url的域名确定邮编
        const urlObj = new URL(url)
        const instance = Scrapeapi.getInstance();
        const zipcode = instance.getZipcodeBySite(urlObj.hostname);
        const list:BestsellerListResType[] = [];
        if (!zipcode) {
            logger.warn(`[TASK 畅销榜排名] 未找到 ${urlObj.hostname} 对应的邮编`)
            return list
        }
        const rankingData = await instance.getFullBestsellerRank(url, zipcode)
        if (!rankingData) {
            logger.warn(`[TASK 畅销榜排名] 获取 ${url} 邮编 ${zipcode} 数据失败`)
            return list
        }

        logger.info(`[TASK 畅销榜排名] 获取 ${url} 邮编 ${zipcode} 数据成功，共 ${rankingData.results.length} 条`)

        for (let i = 0; i < rankingData.results.length; i++) {
            const item = rankingData.results[i]
            list.push(sellersRankToRecord(item, null,sites[0]))
        }

        return list
    }

    //初始化系统
    async init(taskName: string, logName: string): Promise<{taskApp?:BitableData,logs?:BitableData}> {
        while (this.isInit){
            await seep(1000)
        }
        this.isInit=true;
        if (!LARK_FOLDER_TOKEN) {
            logger.error(`[TASK INIT] LARK_FOLDER_TOKEN 未配置，任务无法运行`);
            this.isInit = false;
            return {}
        }
        const result = {
            taskApp: await TaskTool.checkAndCreateDocs(BitableType.TASK, taskName),
                logs: await TaskTool.checkAndCreateDocs(BitableType.LOG, logName),
        }
        this.isInit = false;
        return result;
    }

    //查询关键字中的ASIN排名数据
    private async getKeywordAsinRank(keywords: string[], asins: string[], sites: {zipcode:string,name:string}[], asinInfoMap: Map<string, ProductDetail>, CompetitorsASINs: string[],nowTime:number): Promise<{keywordRank:KeywordsListResType[]}> {
        //默认只查询3页
        const count = 3;
        const instance = Scrapeapi.getInstance();
        const records: KeywordsListResType[] = [];
        const asinList = [...asins, ...CompetitorsASINs]
        // const thisProduct:ThisProductResType[] = []
        await Promise.all(sites.map(async site => {
            //站点
            const zipcode = site.zipcode
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
                        if (founds.length >= asinList.length) {
                            break;
                        }
                    }
                }
                logger.debug(`[TASK2] 关键字查询ASIN排名中，关键词:${keyword} 邮编：${zipcode} 找到ASIN数:${founds.length}`)
                records.push(...asinList.map(tempAsin => {
                    const found = founds.find(r => r.asin === tempAsin);
                    return keyListToRecord(keyword, tempAsin,site, found,nowTime)
                }))


            }

        }))

        return {
            keywordRank: records,
        }

    }

}

