import { prisma } from '@/lib/db';

/**
 * Fetches top-performing published posts for an account
 * to use as few-shot brand voice examples in the system prompt.
 */
export async function getTopPostsForAccount(accountId, limit = 5) {
  if (!accountId) return [];

  const posts = await prisma.post.findMany({
    where: {
      accountId,
      status: 'PUBLISHED',
    },
    include: {
      metrics: {
        orderBy: { fetchedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  return posts
    .filter(p => p.metrics[0]?.engagementRate > 0)
    .sort((a, b) => (b.metrics[0]?.engagementRate || 0) - (a.metrics[0]?.engagementRate || 0))
    .slice(0, limit)
    .map(p => ({
      content: p.content.slice(0, 200),
      contentType: p.contentType,
      engagementRate: p.metrics[0]?.engagementRate,
    }));
}
