import axios from 'axios';
import robotsParser from 'robots-parser';

// Cache for robots.txt strings, key is domain
const robotsCache: Record<string, any> = {};

export async function checkRobotsTxt(domainUrl: string, url: string, userAgent: string = 'MyWebCrawler/1.0'): Promise<boolean> {
  let robotsTxtUrl = new URL('/robots.txt', domainUrl).href;
  
  if (!robotsCache[domainUrl]) {
    try {
      const response = await axios.get(robotsTxtUrl, { timeout: 5000 });
      robotsCache[domainUrl] = robotsParser(robotsTxtUrl, response.data);
    } catch (e) {
      // If no robots.txt or fails, assume allowed
      robotsCache[domainUrl] = robotsParser(robotsTxtUrl, '');
    }
  }

  const parser = robotsCache[domainUrl];
  const isAllowed = parser.isAllowed(url, userAgent);
  // Default to true if undefined
  return isAllowed !== false;
}
