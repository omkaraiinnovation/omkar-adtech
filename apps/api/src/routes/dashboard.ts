import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getCached, setCached, CACHE_TTL } from '../lib/redis';

export const dashboardRouter = router({
  // Unified dashboard overview
  getOverview: protectedProcedure
    .input(z.object({ range: z.enum(['7d', '30d', '90d']).default('30d') }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `dashboard:overview:${ctx.clerkUserId}:${input.range}`;
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return cached;

      const user = await ctx.prisma.user.findUnique({
        where: { clerkId: ctx.clerkUserId },
        include: {
          campaigns: {
            include: {
              leads: { select: { status: true, createdAt: true } },
              budgetAllocations: {
                orderBy: { date: 'desc' },
                take: 7,
                select: { spend: true, roas: true, date: true, impressions: true, clicks: true },
              },
            },
          },
        },
      });

      if (!user) return null;

      const days = input.range === '7d' ? 7 : input.range === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const recentLeads = user.campaigns.flatMap((c: { leads: Array<{ status: string; createdAt: Date }> }) =>
        c.leads.filter((l: { status: string; createdAt: Date }) => l.createdAt >= since)
      );

      const recentAllocations = user.campaigns.flatMap(
        (c: { budgetAllocations: Array<{ spend: number; roas: number; date: Date; impressions: number; clicks: number }> }) =>
          c.budgetAllocations
      );

      type AllocItem = { spend: number; roas: number; date: Date; impressions: number; clicks: number };
      const totalSpend = recentAllocations.reduce((s: number, a: AllocItem) => s + a.spend, 0);
      const avgRoas =
        recentAllocations.length > 0
          ? recentAllocations.reduce((s: number, a: AllocItem) => s + a.roas, 0) / recentAllocations.length
          : 0;

      const result = {
        kpis: {
          totalSpendPaisa: totalSpend,
          totalLeads: recentLeads.length,
          avgRoas: Math.round(avgRoas * 100) / 100,
          avgCplPaisa: recentLeads.length > 0 ? Math.round(totalSpend / recentLeads.length) : 0,
          activeCampaigns: user.campaigns.filter((c: { status: string }) => c.status === 'ACTIVE').length,
          enrolledLeads: recentLeads.filter((l: { status: string }) => l.status === 'ENROLLED').length,
        },
        recentCampaigns: user.campaigns.slice(0, 10),
        range: input.range,
        generatedAt: new Date(),
      };

      await setCached(cacheKey, result, CACHE_TTL.METRICS_10MIN);
      return result;
    }),
});
