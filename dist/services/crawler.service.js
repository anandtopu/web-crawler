"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCrawlJob = processCrawlJob;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const redis_1 = require("../utils/redis");
const url_1 = require("../utils/url");
const db_service_1 = require("./db.service");
const robots_1 = require("../utils/robots");
const queue_service_1 = require("./queue.service");
const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '3', 10);
const USER_AGENT = 'MyWebCrawler/1.0 (System Design Portfolio Project)';
async function processCrawlJob(url, currentDepth) {
    // 1. Normalize and check if already seen (handled before enqueuing as well, but double check)
    const normUrl = (0, url_1.normalizeUrl)(url);
    if (!normUrl)
        return;
    const domain = (0, url_1.getDomain)(normUrl);
    if (!domain)
        return;
    // 2. Robots.txt check
    const allowed = await (0, robots_1.checkRobotsTxt)(`https://${domain}`, normUrl, USER_AGENT);
    if (!allowed) {
        console.log(`[Crawler] URL skipped by robots.txt: ${normUrl}`);
        return;
    }
    // 3. Mark as Seen
    await (0, redis_1.markUrlSeen)(normUrl);
    try {
        // 4. Fetch the Page
        console.log(`[Crawler] Fetching: ${normUrl} (Depth: ${currentDepth})`);
        const response = await axios_1.default.get(normUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000,
            responseType: 'text',
            validateStatus: (status) => status < 400, // Only success
        });
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
            console.log(`[Crawler] Skipping non-HTML resource: ${normUrl}`);
            return; // Only crawl HTML
        }
        // 5. Parse Content and Links
        const $ = cheerio.load(response.data);
        const title = $('title').text() || null;
        $('script').remove();
        $('style').remove();
        const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000); // Take first 10k chars
        const outlinks = [];
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                const fullChildUrl = (0, url_1.normalizeUrl)(href, normUrl);
                if (fullChildUrl && !outlinks.includes(fullChildUrl)) {
                    outlinks.push(fullChildUrl);
                }
            }
        });
        // 6. Save to DB
        await (0, db_service_1.saveCrawledPage)(normUrl, title, textContent, outlinks);
        // 7. Enqueue new links (if max depth not reached)
        if (currentDepth < MAX_DEPTH) {
            for (const link of outlinks) {
                const isSeen = await (0, redis_1.isUrlSeen)(link);
                if (!isSeen) {
                    // Pre-emptively mark seen to avoid adding duplicate links to queue simultaneously
                    await (0, redis_1.markUrlSeen)(link);
                    await (0, queue_service_1.enqueueUrl)(link, currentDepth + 1);
                }
            }
        }
    }
    catch (error) {
        console.error(`[Crawler] Error fetching ${normUrl}: ${error.message}`);
        // If it fails, could optionally retry, but BullMQ handles retry on thrown exceptions
        // depending on settings. Since we caught and logged, we don't crash.
    }
}
