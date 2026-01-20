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
  logger.info('[TASK] scheduler started')
}
