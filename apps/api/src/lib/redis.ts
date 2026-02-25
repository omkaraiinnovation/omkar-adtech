import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
  throw new Error('UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN must be set');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Cache helpers with INR-aware TTLs
export const CACHE_TTL = {
  METRICS_10MIN: 600,        // 10 minutes (Google/Meta metrics cache)
  LEAD_FORM_5MIN: 300,       // 5 minutes (Google Lead Forms poll cache)
  UCB_SCORES_1MIN: 60,       // 1 minute (MAB arm scores)
  FORECAST_1HR: 3600,        // 1 hour (launch forecasts)
} as const;

export async function getCached<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function setCached<T>(key: string, value: T, ttl: number): Promise<void> {
  await redis.set(key, value, { ex: ttl });
}

export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// MAB arm key helper
export function mabArmKey(campaignId: string, adSetId: string, creativeId: string): string {
  return `mab:arm:${campaignId}:${adSetId}:${creativeId}`;
}
