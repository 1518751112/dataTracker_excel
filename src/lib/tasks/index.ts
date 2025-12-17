import cron from 'node-cron'
import logger from '@/lib/logger'
import {TaskService} from '@/lib/tasks/task.server'

let started = false

export function startTasks() {
  if (started) return
  started = true

  const taskService = new TaskService()

  cron.schedule('*/1 * * * *', () => {
    const m = process.memoryUsage()
    logger.info(`[TASK] memory rss=${m.rss} heapUsed=${m.heapUsed}`)
  }, { timezone: 'Asia/Shanghai' })
  cron.schedule('0 1 * * *', async () => {
    try {
      await taskService.run()
    }catch (e) {
      logger.error(e);
    }
  }, { timezone: 'Asia/Shanghai' })
  logger.info('[TASK] scheduler started')
}
