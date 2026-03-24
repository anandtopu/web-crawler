export function normalizeUrl(url: string, baseUrl?: string): string | null {
  try {
    const parsedUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
    
    // We only want to crawl HTTP and HTTPS URLs
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    // Remove fragments
    parsedUrl.hash = '';

    return parsedUrl.href;
  } catch (err) {
    return null; // Invalid URL
  }
}

export function getDomain(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (err) {
    return null;
  }
}
