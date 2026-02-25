import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './lib/logger';

// ===== CONTEXT =====

export async function createContext({ req }: CreateExpressContextOptions) {
  // Extract Clerk user ID from Authorization header
  const authHeader = req.headers.authorization;
  const clerkUserId = authHeader?.replace('Bearer ', '') ?? null;

  return {
    req,
    prisma,
    redis,
    logger,
    clerkUserId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// ===== TRPC INIT =====

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ===== MIDDLEWARE =====

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  logger.info({ path, type, durationMs, ok: result.ok }, 'tRPC request');
  return result;
});

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, clerkUserId: ctx.clerkUserId } });
});

// ===== PROCEDURES =====

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const protectedProcedure = t.procedure.use(loggerMiddleware).use(authMiddleware);
export const mergeRouters = t.mergeRouters;
