import path, {join} from 'path'
//为了编译后能正确识别别名路径
const moduleAlias = require('module-alias')
moduleAlias.addAliases({
  '@'  : __dirname,
  '@lib': join(__dirname, 'lib'),
})

import express from 'express'
import {middle} from "@lib/middle";
import {SERVER_PORT} from './config/env'
import logger from '@lib/logger'
import {startTasks} from '@lib/tasks'
import {BackendDataScalerService} from "@/services/backend.datascaler";
import fileRouter from "./routes/file";
import {TaskService} from "@lib/tasks/task.server";



const app = express()
//监听线程异常
process.on('uncaughtException', function (err) {
  console.error('线程出现异常=>>', err);
  logger.error('线程出现异常=>> ' + (err && err.stack ? err.stack : String(err)))
});
process.on('unhandledRejection', function (reason, promise) {
  console.error('线程异常未处理=>>', reason);
  console.error('注:该异常系统容易崩溃');
});

process.on('SIGINT', () => {
  console.log('进程退出中...请稍候，1');
  logger.info('进程退出中...请稍候');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('进程退出中...请稍候,2');
  logger.info('进程退出中...请稍候');
  process.exit(0);
});

//注册中间件
middle(app)

// 静态托管 client 前端
const clientDir = path.join(process.cwd(), 'client')
app.use(express.static(clientDir))
logger.info('静态目录: ' + clientDir)

// app.use('/api/auth', authRouter)
// app.use('/api/bitable', bitableRouter)
app.use('/api/file', fileRouter)


app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
BackendDataScalerService.createInstance();
const PORT = SERVER_PORT ? Number(SERVER_PORT) : 3001
app.listen(PORT, () => {
  startTasks()
  logger.info(`TS Server running at http://localhost:${PORT}`)
  try{
    new TaskService().run()
  }catch(err){
  }
})

