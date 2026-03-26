"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUrl = normalizeUrl;
exports.getDomain = getDomain;
function normalizeUrl(url, baseUrl) {
    try {
        const parsedUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
        // We only want to crawl HTTP and HTTPS URLs
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }
        // Remove fragments
        parsedUrl.hash = '';
        return parsedUrl.href;
    }
    catch (err) {
        return null; // Invalid URL
    }
}
function getDomain(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname;
    }
    catch (err) {
        return null;
    }
}
