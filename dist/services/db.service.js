"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCrawledPage = saveCrawledPage;
exports.getStats = getStats;
exports.getRecentCrawlHistory = getRecentCrawlHistory;
const prisma_1 = require("../db/prisma");
async function saveCrawledPage(url, title, content, outlinks) {
    try {
        // Upsert the page content
        const page = await prisma_1.prisma.page.upsert({
            where: { url },
            update: { title, content, crawledAt: new Date() },
            create: { url, title, content },
        });
        // Save outgoing links (a bit heavier on DB if not optimized, but fine for this scale)
        // First, delete old links for this page id to avoid duplicates on re-crawl
        await prisma_1.prisma.link.deleteMany({
            where: { sourceId: page.id },
        });
        if (outlinks.length > 0) {
            await prisma_1.prisma.link.createMany({
                data: outlinks.map((targetUrl) => ({
                    sourceId: page.id,
                    targetUrl,
                })),
                skipDuplicates: true,
            });
        }
        return page;
    }
    catch (error) {
        console.error(`[DB Service] Error saving page ${url}:`, error);
        throw error;
    }
}
async function getStats() {
    const pageCount = await prisma_1.prisma.page.count();
    const linkCount = await prisma_1.prisma.link.count();
    return { pageCount, linkCount };
}
async function getRecentCrawlHistory(limit = 50) {
    return await prisma_1.prisma.page.findMany({
        orderBy: { crawledAt: 'desc' },
        take: limit,
        select: {
            id: true,
            url: true,
            title: true,
            crawledAt: true,
            _count: {
                select: { linksOut: true },
            },
        },
    });
}
