import logger from '@/lib/logger'
import {LARK_FOLDER_TOKEN, TASK_LIST_TABLE_NAME} from '@/config/env'
import {
    createApp,
    createTable,
    ensureFields,
    listTables,
} from '@/services/bitable'
import {getTenantAccessToken} from '@/services/larkAuth'
import {BitableType, readAllBitables, writeAllBitables} from "@lib/localData";
import {FieldSpec} from "@/types/bitable";

export class TaskTool {

    //检测飞书文档并创建
    public static async checkAndCreateDocs(type: BitableType, name: string) {
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


    //查询或创建数据表
    public static async ensureTable(accessToken: string, logAppToken: string, tableName: string,listTableInfo:any[], fields: FieldSpec[]) {
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

    //转为百分比同时加上%
    public static toPercentage(value: number | null | undefined) {
        if (value === null || value === undefined) return null
        return (value * 100).toFixed(2) + '%'
    }

}

