import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisConnection } from '../utils/redis';
import { processCrawlJob } from './crawler.service';
import dotenv from 'dotenv';
dotenv.config();

const QUEUE_NAME = 'crawler-queue';

export const crawlerQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection as any,
});

export const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection as any,
});

let worker: Worker | null = null;

export function initWorker() {
  const concurrency = parseInt(process.env.CONCURRENCY || '5', 10);
  
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await processCrawlJob(job.data.url, job.data.depth || 0);
    },
    {
      connection: redisConnection as any,
      concurrency,
      // Global rate limiter applied on the worker for politeness
      limiter: {
        max: parseInt(process.env.MAX_REQUESTS_PER_DURATION || '10', 10),
        duration: parseInt(process.env.RATE_LIMIT_DURATION_MS || '1000', 10),
      },
    }
  );

  worker.on('completed', (job) => {
    // console.log(`[Worker] Completed job ${job.id} for URL: ${job.data.url}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Failed job ${job?.id} for URL: ${job?.data.url} - ${err.message}`);
  });

  console.log(`[Worker] Initialized crawler worker with concurrency: ${concurrency}`);
}

export async function enqueueUrl(url: string, depth: number = 0) {
  await crawlerQueue.add(
    'crawl',
    { url, depth },
    {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

export async function shutdownQueue() {
  if (worker) {
    await worker.close();
  }
  await crawlerQueue.close();
  await queueEvents.close();
  redisConnection.disconnect();
}
