"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const db_service_1 = require("./services/db.service");
const queue_service_1 = require("./services/queue.service");
const redis_1 = require("./utils/redis");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
const PORT = process.env.PORT || 5000;
// API Status
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});
// Trigger a crawl
app.post('/api/crawl/start', async (req, res) => {
    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    try {
        await (0, queue_service_1.resumeQueue)(); // Ensure it's not paused before adding
        // Add to queue manually for depth 0
        await (0, redis_1.markUrlSeen)(url);
        await (0, queue_service_1.enqueueUrl)(url, 0);
        res.json({ message: 'Crawling started', url });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get metrics
app.get('/api/crawl/stats', async (req, res) => {
    try {
        const dbStats = await (0, db_service_1.getStats)();
        // BullMQ specific status
        const waiting = await queue_service_1.crawlerQueue.getWaitingCount();
        const active = await queue_service_1.crawlerQueue.getActiveCount();
        const completed = await queue_service_1.crawlerQueue.getCompletedCount();
        const failed = await queue_service_1.crawlerQueue.getFailedCount();
        const seenCount = await (0, redis_1.getSeenCount)();
        res.json({
            db: dbStats,
            queue: { waiting, active, completed, failed },
            redis: { seenUrls: seenCount },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get crawl history
app.get('/api/crawl/history', async (req, res) => {
    try {
        const history = await (0, db_service_1.getRecentCrawlHistory)(50);
        res.json(history);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Stop a crawl
app.post('/api/crawl/stop', async (req, res) => {
    try {
        await (0, queue_service_1.clearQueue)();
        res.json({ message: 'Crawling stopped and queue cleared' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Start the server and worker
async function bootstrap() {
    console.log('Starting Web Crawler Coordinator & Worker...');
    // Initialize BullMQ worker
    (0, queue_service_1.initWorker)();
    const server = app.listen(PORT, () => {
        console.log(`API Server listening on port ${PORT}`);
    });
    // Graceful shutdown
    const gracefulShutdown = async () => {
        console.log('Shutting down gracefully...');
        server.close();
        await (0, queue_service_1.shutdownQueue)();
        process.exit(0);
    };
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
}
bootstrap();
