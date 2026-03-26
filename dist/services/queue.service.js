"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueEvents = exports.crawlerQueue = void 0;
exports.initWorker = initWorker;
exports.enqueueUrl = enqueueUrl;
exports.clearQueue = clearQueue;
exports.resumeQueue = resumeQueue;
exports.shutdownQueue = shutdownQueue;
const bullmq_1 = require("bullmq");
const redis_1 = require("../utils/redis");
const crawler_service_1 = require("./crawler.service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const QUEUE_NAME = 'crawler-queue';
exports.crawlerQueue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redisConnection,
});
exports.queueEvents = new bullmq_1.QueueEvents(QUEUE_NAME, {
    connection: redis_1.redisConnection,
});
let worker = null;
let isCrawlingStopped = false;
function initWorker() {
    const concurrency = parseInt(process.env.CONCURRENCY || '5', 10);
    worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        await (0, crawler_service_1.processCrawlJob)(job.data.url, job.data.depth || 0);
    }, {
        connection: redis_1.redisConnection,
        concurrency,
        // Global rate limiter applied on the worker for politeness
        limiter: {
            max: parseInt(process.env.MAX_REQUESTS_PER_DURATION || '10', 10),
            duration: parseInt(process.env.RATE_LIMIT_DURATION_MS || '1000', 10),
        },
    });
    worker.on('completed', (job) => {
        // console.log(`[Worker] Completed job ${job.id} for URL: ${job.data.url}`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[Worker] Failed job ${job?.id} for URL: ${job?.data.url} - ${err.message}`);
    });
    console.log(`[Worker] Initialized crawler worker with concurrency: ${concurrency}`);
}
async function enqueueUrl(url, depth = 0) {
    if (isCrawlingStopped) {
        return; // Do not enqueue if crawling is stopped
    }
    await exports.crawlerQueue.add('crawl', { url, depth }, {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    });
}
async function clearQueue() {
    isCrawlingStopped = true;
    await exports.crawlerQueue.pause();
    await exports.crawlerQueue.drain(true); // removes waiting and delayed jobs
}
async function resumeQueue() {
    isCrawlingStopped = false;
    await exports.crawlerQueue.resume();
}
async function shutdownQueue() {
    if (worker) {
        await worker.close();
    }
    await exports.crawlerQueue.close();
    await exports.queueEvents.close();
    redis_1.redisConnection.disconnect();
}
