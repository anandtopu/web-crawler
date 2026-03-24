# Distrubuted Web Crawler

This is a production-ready Web Crawler built as a System Design Portfolio Project. It is designed to be scalable, fault-tolerant, polite (respecting `robots.txt` and rate limits), and efficient.

## Architecture & System Design
The complete System Design Document detailing the requirements, database schema, and high-level architecture can be found in [Project.md](./Project.md).

## Tech Stack
- **Node.js** & **TypeScript**
- **Express.js** (API Server)
- **BullMQ** & **Redis** (Distributed Queue & URL Frontier)
- **PostgreSQL** & **Prisma ORM** (Storage Layer)
- **Cheerio** & **Axios** (Parsing & Fetching)

## Features
- Distributed architecture (Coordinator + N Workers)
- Strict adherence to `robots.txt`
- Domain-level Politeness and Rate Limiting
- Deduplication via Redis Seen Set
- Multi-threaded, asynchronous processing

## Deployment & Setup

### Prerequisites
- Docker Compose installed.

### 1. Run the system
You can easily spin up the complete architecture (PostgreSQL, Redis, and the Node Web Crawler APIs) using Docker Compose:

```bash
docker-compose up --build -d
```

This command will:
1. Start a Redis instance.
2. Start a PostgreSQL instance.
3. Build the Node.js Dockerfile.
4. Run `prisma db push` to initialize the database schema.
5. Start the Express API server and background BullMQ workers.

### 2. Verify it is running
Check the logs of the crawler container:
```bash
docker-compose logs -f crawler-api
```

You should see:
```text
[Worker] Initialized crawler worker with concurrency: 5
API Server listening on port 3000
```

## API Usage

### 1. Start a Crawl
Send a `POST` request with the initial seed URL.

**Request (Windows CMD):**
```bash
curl -X POST http://localhost:3000/api/crawl/start -H "Content-Type: application/json" -d "{\"url\":\"https://example.com\"}"
```

**Request (Bash/macOS/Linux):**
```bash
curl -X POST http://localhost:3000/api/crawl/start \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

The crawler will pick up the URL, fetch it, extract outgoing links, save the page text/metadata to PostgreSQL, and recursively enqueue internal and external links found (up to `MAX_DEPTH`).

### 2. Monitor Crawler Status
Send a `GET` request to see queue metrics and database counts.

**Request:**
```bash
curl http://localhost:3000/api/crawl/stats
```

**Response:**
```json
{
  "db": {
    "pageCount": 15,
    "linkCount": 42
  },
  "queue": {
    "waiting": 20,
    "active": 5,
    "completed": 15,
    "failed": 0
  },
  "redis": {
    "seenUrls": 35
  }
}
```

## Environment Configuration
You can configure the crawler behavior by editing the `.env` file (or passing them natively in `docker-compose.yml`):
- `MAX_DEPTH` (default: 3)
- `CONCURRENCY` (default: 5 worker threads)
- `RATE_LIMIT_DURATION_MS` (default: 1000)
- `MAX_REQUESTS_PER_DURATION` (default: 2 per domain per worker)
