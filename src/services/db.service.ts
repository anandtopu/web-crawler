import { prisma } from '../db/prisma';

export async function saveCrawledPage(
  url: string,
  title: string | null,
  content: string | null,
  outlinks: string[]
) {
  try {
    // Upsert the page content
    const page = await prisma.page.upsert({
      where: { url },
      update: { title, content, crawledAt: new Date() },
      create: { url, title, content },
    });

    // Save outgoing links (a bit heavier on DB if not optimized, but fine for this scale)
    // First, delete old links for this page id to avoid duplicates on re-crawl
    await prisma.link.deleteMany({
      where: { sourceId: page.id },
    });

    if (outlinks.length > 0) {
      await prisma.link.createMany({
        data: outlinks.map((targetUrl) => ({
          sourceId: page.id,
          targetUrl,
        })),
        skipDuplicates: true,
      });
    }

    return page;
  } catch (error) {
    console.error(`[DB Service] Error saving page ${url}:`, error);
    throw error;
  }
}

export async function getStats() {
  const pageCount = await prisma.page.count();
  const linkCount = await prisma.link.count();
  return { pageCount, linkCount };
}
