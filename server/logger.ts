import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:h:MM:ss TT',
            ignore: 'pid,hostname',
          },
        },
      }),
  base: {
    service: 'coffee-management',
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
