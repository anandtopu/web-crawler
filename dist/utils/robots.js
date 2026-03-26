"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRobotsTxt = checkRobotsTxt;
const axios_1 = __importDefault(require("axios"));
const robots_parser_1 = __importDefault(require("robots-parser"));
// Cache for robots.txt strings, key is domain
const robotsCache = {};
async function checkRobotsTxt(domainUrl, url, userAgent = 'MyWebCrawler/1.0') {
    let robotsTxtUrl = new URL('/robots.txt', domainUrl).href;
    if (!robotsCache[domainUrl]) {
        try {
            const response = await axios_1.default.get(robotsTxtUrl, { timeout: 5000 });
            robotsCache[domainUrl] = (0, robots_parser_1.default)(robotsTxtUrl, response.data);
        }
        catch (e) {
            // If no robots.txt or fails, assume allowed
            robotsCache[domainUrl] = (0, robots_parser_1.default)(robotsTxtUrl, '');
        }
    }
    const parser = robotsCache[domainUrl];
    const isAllowed = parser.isAllowed(url, userAgent);
    // Default to true if undefined
    return isAllowed !== false;
}
