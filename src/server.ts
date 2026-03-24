import express from 'express';
import cors from 'cors';
import { getStats } from './services/db.service';
import { enqueueUrl, crawlerQueue, initWorker, shutdownQueue } from './services/queue.service';
import { getSeenCount, markUrlSeen } from './utils/redis';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

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
    // Add to queue manually for depth 0
    await markUrlSeen(url);
    await enqueueUrl(url, 0);
    res.json({ message: 'Crawling started', url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get metrics
app.get('/api/crawl/stats', async (req, res) => {
  try {
    const dbStats = await getStats();
    // BullMQ specific status
    const waiting = await crawlerQueue.getWaitingCount();
    const active = await crawlerQueue.getActiveCount();
    const completed = await crawlerQueue.getCompletedCount();
    const failed = await crawlerQueue.getFailedCount();
    const seenCount = await getSeenCount();

    res.json({
      db: dbStats,
      queue: { waiting, active, completed, failed },
      redis: { seenUrls: seenCount },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start the server and worker
async function bootstrap() {
  console.log('Starting Web Crawler Coordinator & Worker...');
  
  // Initialize BullMQ worker
  initWorker();

  const server = app.listen(PORT, () => {
    console.log(`API Server listening on port ${PORT}`);
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    server.close();
    await shutdownQueue();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

bootstrap();
