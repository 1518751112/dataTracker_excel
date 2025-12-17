import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

winston.addColors({ error: 'bold red', warn: 'bold yellow', info: 'green', verbose: 'cyan', debug: 'blue', silly: 'grey' })
const colorizer = winston.format.colorize()
const consoleFmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => colorizer.colorize(level, `${timestamp} [${level}] ${typeof message === 'string' ? message : JSON.stringify(message)}`))
)

const fileFmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}] ${typeof message === 'string' ? message : JSON.stringify(message)}`)
)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format: consoleFmt }),
    new DailyRotateFile({ dirname: 'logs',
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '3m',
      maxFiles: '30d',
      format: fileFmt })
  ]
})

const stream = { write: (msg: string) => logger.info(String(msg).trim()) }

export default logger
export { stream }
