import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

prisma.$on('warn', (e: { message: string }) => {
  logger.warn({ message: e.message }, 'Prisma warning');
});

prisma.$on('error', (e: { message: string }) => {
  logger.error({ message: e.message }, 'Prisma error');
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
