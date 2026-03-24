import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisConnection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
});

/**
 * URL Seen Set Implementation
 * Uses a Redis SET to store standard normalized URLs.
 * In a real-world hyper-scale scenario, we would use a Redis Bloom Filter,
 * but a SET is perfectly fine for portfolio/millions of URLs scale.
 */
export async function isUrlSeen(url: string): Promise<boolean> {
  const result = await redisConnection.sismember('crawler:seen_urls', url);
  return result === 1;
}

export async function markUrlSeen(url: string): Promise<void> {
  await redisConnection.sadd('crawler:seen_urls', url);
}

export async function getSeenCount(): Promise<number> {
  return await redisConnection.scard('crawler:seen_urls');
}
