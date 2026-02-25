/**
 * Upstash Redis-based rate limiting middleware
 *
 * Implements a sliding window counter per IP address.
 * Limits: 100 req/min on all public endpoints (plan spec: security architecture).
 *
 * Stricter limits on sensitive endpoints:
 * - Webhooks: 300 req/min (high-volume Meta/WhatsApp traffic expected)
 * - Auth-sensitive tRPC mutations: 20 req/min
 *
 * Falls back to no-op if Redis is not configured.
 */

import { Redis } from '@upstash/redis';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

/**
 * Extract a stable client identifier.
 * Prefers X-Forwarded-For (set by Vercel/Railway proxy), falls back to socket IP.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return (first ?? 'unknown').trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
  /** Optional key prefix to namespace different limiters */
  prefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  windowSec: 60,
  prefix: 'rl:default',
};

/**
 * Core sliding window rate limit check using Upstash Redis.
 * Returns { allowed, remaining, resetAt }.
 */
async function checkRateLimit(
  ip: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const r = getRedis();
  if (!r) {
    // Redis not configured — allow all requests (dev/test mode)
    return { allowed: true, remaining: config.limit, resetAt: 0 };
  }

  const key = `${config.prefix ?? 'rl'}:${ip}`;
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const windowStart = now - windowMs;

  // Lua script: atomic sliding window counter
  // 1. Remove entries older than the window
  // 2. Add current timestamp
  // 3. Count entries in window
  // 4. Set TTL to window duration
  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local window_sec = tonumber(ARGV[4])

    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
    redis.call('ZADD', key, now, now)
    local count = redis.call('ZCARD', key)
    redis.call('EXPIRE', key, window_sec + 1)

    return count
  `;

  try {
    const count = await r.eval(luaScript, [key], [String(now), String(windowStart), String(config.limit), String(config.windowSec)]) as number;
    const allowed = count <= config.limit;
    const remaining = Math.max(0, config.limit - count);
    const resetAt = Math.ceil((now + windowMs) / 1000);

    return { allowed, remaining, resetAt };
  } catch (err) {
    // Redis error — fail open (allow request) to avoid blocking legitimate traffic
    logger.warn({ err, key }, 'Rate limit Redis error — failing open');
    return { allowed: true, remaining: config.limit, resetAt: 0 };
  }
}

/**
 * Creates an Express rate limiting middleware with the given config.
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const ip = getClientIp(req);
    const { allowed, remaining, resetAt } = await checkRateLimit(ip, finalConfig);

    // Set standard rate limit headers (RFC 6585)
    res.setHeader('X-RateLimit-Limit', finalConfig.limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetAt);

    if (!allowed) {
      logger.warn({ ip, path: req.path }, 'Rate limit exceeded');
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${finalConfig.limit} requests per ${finalConfig.windowSec}s.`,
        retryAfter: resetAt,
      });
      return;
    }

    next();
  };
}

// ===== Pre-configured limiters =====

/** General API rate limiter: 100 req/min */
export const generalLimiter = createRateLimiter({
  limit: 100,
  windowSec: 60,
  prefix: 'rl:general',
});

/** Webhook limiter: 300 req/min (Meta/WhatsApp send high volumes) */
export const webhookLimiter = createRateLimiter({
  limit: 300,
  windowSec: 60,
  prefix: 'rl:webhook',
});

/** Strict limiter for sensitive mutations: 20 req/min */
export const strictLimiter = createRateLimiter({
  limit: 20,
  windowSec: 60,
  prefix: 'rl:strict',
});
