"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
exports.isUrlSeen = isUrlSeen;
exports.markUrlSeen = markUrlSeen;
exports.getSeenCount = getSeenCount;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
exports.redisConnection = new ioredis_1.default({
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
async function isUrlSeen(url) {
    const result = await exports.redisConnection.sismember('crawler:seen_urls', url);
    return result === 1;
}
async function markUrlSeen(url) {
    await exports.redisConnection.sadd('crawler:seen_urls', url);
}
async function getSeenCount() {
    return await exports.redisConnection.scard('crawler:seen_urls');
}
