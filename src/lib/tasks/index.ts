import cron from 'node-cron'
import logger from '@/lib/logger'

let started = false

export function startTasks() {
  if (started) return
  started = true
  //每天凌晨1点执行的任务
  cron.schedule('0 1 * * *', () => {
    const m = process.memoryUsage()
    logger.info(`[TASK] memory rss=${m.rss} heapUsed=${m.heapUsed}`)
  }, { timezone: 'Asia/Shanghai' })
  logger.info('[TASK] scheduler started')
}
