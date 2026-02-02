import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCached<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  return cached as T | null;
}

export async function setCache<T>(
  key: string,
  value: T,
  expirationSeconds: number = 3600
): Promise<void> {
  await redis.set(key, value, { ex: expirationSeconds });
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}
