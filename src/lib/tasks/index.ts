import cron from 'node-cron'
import logger from '@/lib/logger'
import {TaskService} from '@/lib/tasks/task.server'
import {TaskTwoService} from "@lib/tasks/task.two.server";

let started = false

export function startTasks() {
  if (started) return
  started = true

  const taskService = new TaskTwoService()



  /*cron.schedule('*!/1 * * * *', () => {
    const m = process.memoryUsage()
    logger.info(`[TASK] memory rss=${(m.rss / 1024 / 1024).toFixed(2)}MB heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(2)}MB`)
  }, { timezone: 'Asia/Shanghai' })*/
  cron.schedule('10 0 * * *', async () => {
    try {
      const result = await Promise.allSettled([
        taskService.runASINListTask(),
        taskService.runAsinDetail(),
      ])
      result.forEach(it => {
        if (it.status == 'rejected') {
          logger.error(`[TASK] ${it.reason}`)
        }
      })
    }catch (e) {
      logger.error(e);
    }
  }, { timezone: 'Asia/Shanghai' })

  // 每周一、周五 0点10分执行
  cron.schedule('10 0 * * 1,5', async () => {
    try {
      const result = await Promise.allSettled([
        taskService.runTopSellersRankTask(),
      ])
      result.forEach(it => {
        if (it.status == 'rejected') {
          logger.error(`[TASK] ${it.reason}`)
        }
      })
    }catch (e) {
      logger.error(e);
    }
  }, { timezone: 'Asia/Shanghai' })



  setTimeout(async ()=>{
    try {
      const result = await Promise.allSettled([
        taskService.runASINListTask(),
        taskService.runAsinDetail(),
        taskService.runTopSellersRankTask(),
      ])
      result.forEach(it => {
        if (it.status == 'rejected') {
          logger.error(`[TASK] ${it.reason}`)
          console.log("it.reason",it.reason)
        }
      })
    }catch (e) {
      logger.error(e);
    }
  },1000)
  logger.info('[TASK] scheduler started')
}
