import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { getCached, setCached, CACHE_TTL } from '../lib/redis';
import { runFullMABCycle, updateArmReward } from '../lib/mab-engine';

export const budgetRouter = router({
  // Get budget allocations for a campaign
  getAllocations: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().cuid(),
        days: z.number().int().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const allocations = await ctx.prisma.budgetAllocation.findMany({
        where: { campaignId: input.campaignId, date: { gte: since } },
        orderBy: { date: 'asc' },
      });
      return allocations;
    }),

  // Get current MAB arm states from Redis
  getMABState: protectedProcedure
    .input(z.object({ campaignId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `mab:summary:${input.campaignId}`;
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return cached;

      // Get all arm keys for this campaign
      const pattern = `mab:arm:${input.campaignId}:*`;
      const keys = await ctx.redis.keys(pattern);

      if (keys.length === 0) {
        return { campaignId: input.campaignId, arms: [], totalArms: 0 };
      }

      const arms = await Promise.all(
        keys.map(async (key) => {
          const arm = await ctx.redis.get(key);
          return { key, ...((arm as Record<string, unknown>) ?? {}) };
        })
      );

      const result = {
        campaignId: input.campaignId,
        arms: arms.filter(Boolean),
        totalArms: arms.length,
        fetchedAt: new Date(),
      };

      await setCached(cacheKey, result, CACHE_TTL.UCB_SCORES_1MIN);
      return result;
    }),

  // Get reallocation audit log
  getReallocationLog: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().cuid(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const allocations = await ctx.prisma.budgetAllocation.findMany({
        where: {
          campaignId: input.campaignId,
          reallocationReason: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          date: true,
          allocated: true,
          previousAmount: true,
          roas: true,
          ucbScore: true,
          reallocationReason: true,
          triggerType: true,
          createdAt: true,
        },
      });

      return allocations;
    }),

  // Dashboard summary: total spend, avg ROAS across all campaigns
  getDashboardSummary: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        range: z.enum(['7d', '30d', '90d']).default('30d'),
      })
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `dashboard:summary:${ctx.clerkUserId}:${input.range}`;
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return cached;

      const user = await ctx.prisma.user.findUnique({
        where: { clerkId: ctx.clerkUserId },
      });
      if (!user) return null;

      const days = input.range === '7d' ? 7 : input.range === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get all campaigns for this user
      const campaigns = await ctx.prisma.campaign.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const campaignIds = campaigns.map((c: { id: string }) => c.id);

      const [allocations, totalLeads, activeCount] = await Promise.all([
        ctx.prisma.budgetAllocation.findMany({
          where: { campaignId: { in: campaignIds }, date: { gte: since } },
          select: { spend: true, roas: true, conversions: true, impressions: true, clicks: true },
        }),
        ctx.prisma.lead.count({ where: { campaignId: { in: campaignIds }, createdAt: { gte: since } } }),
        ctx.prisma.campaign.count({ where: { userId: user.id, status: 'ACTIVE' } }),
      ]);

      type AllocSum = { spend: number; roas: number };
      const totalSpend = (allocations as AllocSum[]).reduce((s: number, a: AllocSum) => s + a.spend, 0);
      const avgRoas = allocations.length
        ? (allocations as AllocSum[]).reduce((s: number, a: AllocSum) => s + a.roas, 0) / allocations.length
        : 0;
      const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

      const result = {
        totalSpendPaisa: totalSpend,
        totalLeads,
        avgRoas: Math.round(avgRoas * 100) / 100,
        avgCplPaisa: Math.round(avgCpl),
        activeCampaigns: activeCount,
        range: input.range,
        calculatedAt: new Date(),
      };

      await setCached(cacheKey, result, CACHE_TTL.METRICS_10MIN);
      return result;
    }),

  // Manually trigger MAB allocation cycle
  triggerMAB: protectedProcedure
    .input(z.object({ totalBudgetPaisa: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkId: ctx.clerkUserId },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const result = await runFullMABCycle(user.id, input.totalBudgetPaisa);
      return result;
    }),

  // Record ROAS reward for an arm (called after conversion event)
  recordArmReward: protectedProcedure
    .input(z.object({
      campaignId: z.string().cuid(),
      adSetId: z.string().cuid(),
      roasReward: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      await updateArmReward(input.campaignId, input.adSetId, input.roasReward);
      return { success: true };
    }),
});
