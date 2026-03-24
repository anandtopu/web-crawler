import axios from 'axios';
import * as cheerio from 'cheerio';
import { isUrlSeen, markUrlSeen } from '../utils/redis';
import { normalizeUrl, getDomain } from '../utils/url';
import { saveCrawledPage } from './db.service';
import { checkRobotsTxt } from '../utils/robots';
import { enqueueUrl } from './queue.service';

const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '3', 10);
const USER_AGENT = 'MyWebCrawler/1.0 (System Design Portfolio Project)';

export async function processCrawlJob(url: string, currentDepth: number) {
  // 1. Normalize and check if already seen (handled before enqueuing as well, but double check)
  const normUrl = normalizeUrl(url);
  if (!normUrl) return;

  const domain = getDomain(normUrl);
  if (!domain) return;

  // 2. Robots.txt check
  const allowed = await checkRobotsTxt(`https://${domain}`, normUrl, USER_AGENT);
  if (!allowed) {
    console.log(`[Crawler] URL skipped by robots.txt: ${normUrl}`);
    return;
  }

  // 3. Mark as Seen
  await markUrlSeen(normUrl);

  try {
    // 4. Fetch the Page
    console.log(`[Crawler] Fetching: ${normUrl} (Depth: ${currentDepth})`);
    const response = await axios.get(normUrl, {
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

    const outlinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const fullChildUrl = normalizeUrl(href, normUrl);
        if (fullChildUrl && !outlinks.includes(fullChildUrl)) {
          outlinks.push(fullChildUrl);
        }
      }
    });

    // 6. Save to DB
    await saveCrawledPage(normUrl, title, textContent, outlinks);

    // 7. Enqueue new links (if max depth not reached)
    if (currentDepth < MAX_DEPTH) {
      for (const link of outlinks) {
        const isSeen = await isUrlSeen(link);
        if (!isSeen) {
          // Pre-emptively mark seen to avoid adding duplicate links to queue simultaneously
          await markUrlSeen(link); 
          await enqueueUrl(link, currentDepth + 1);
        }
      }
    }
  } catch (error: any) {
    console.error(`[Crawler] Error fetching ${normUrl}: ${error.message}`);
    // If it fails, could optionally retry, but BullMQ handles retry on thrown exceptions
    // depending on settings. Since we caught and logged, we don't crash.
  }
}
