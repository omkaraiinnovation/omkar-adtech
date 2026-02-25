import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { CACHE_TTL, getCached, setCached } from '../lib/redis';
import {
  getGoogleAdsCreds,
  pauseGoogleAdsCampaign,
  resumeGoogleAdsCampaign,
  updateGoogleAdsCampaignBudget,
} from '../lib/google-ads';
import {
  getMetaAdsCreds,
  pauseMetaCampaign,
  resumeMetaCampaign,
  updateMetaCampaignBudget,
} from '../lib/meta-ads';
import { logger } from '../lib/logger';

const campaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  platform: z.enum(['GOOGLE', 'META']),
  objective: z.enum(['LEAD_GEN', 'CONVERSIONS', 'AWARENESS', 'TRAFFIC']),
  dailyBudget: z.number().int().positive(), // INR paisa
  lifetimeBudget: z.number().int().positive().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  targeting: z.object({
    locations: z.array(z.string()),
    ageMin: z.number().int().min(18).max(65),
    ageMax: z.number().int().min(18).max(65),
    genders: z.array(z.enum(['MALE', 'FEMALE', 'ALL'])),
    interests: z.array(z.string()),
    devices: z.array(z.enum(['MOBILE', 'DESKTOP', 'TABLET'])).optional(),
  }),
});

export const campaignsRouter = router({
  // Get all campaigns for the authenticated user
  getAll: protectedProcedure
    .input(
      z.object({
        platform: z.enum(['GOOGLE', 'META']).optional(),
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkId: ctx.clerkUserId },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const campaigns = await ctx.prisma.campaign.findMany({
        where: {
          userId: user.id,
          ...(input?.platform && { platform: input.platform }),
          ...(input?.status && { status: input.status }),
        },
        include: {
          adSets: { include: { creatives: true } },
          budgetAllocations: {
            orderBy: { date: 'desc' },
            take: 7,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 50,
        skip: input?.offset ?? 0,
      });

      return campaigns;
    }),

  // Get single campaign with full details
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          user: true,
          adSets: {
            include: {
              creatives: {
                include: { complianceAudits: { orderBy: { createdAt: 'desc' }, take: 1 } },
              },
            },
          },
          leads: { take: 100, orderBy: { createdAt: 'desc' } },
          budgetAllocations: { orderBy: { date: 'desc' }, take: 30 },
        },
      });

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      return campaign;
    }),

  // Create new campaign
  create: protectedProcedure
    .input(campaignCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkId: ctx.clerkUserId },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const campaign = await ctx.prisma.campaign.create({
        data: {
          ...input,
          userId: user.id,
          targeting: input.targeting,
        },
      });

      return campaign;
    }),

  // Update campaign
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        data: campaignCreateSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.update({
        where: { id: input.id },
        data: input.data,
      });

      // Invalidate cache
      await ctx.redis.del(`metrics:campaign:${input.id}`);
      return campaign;
    }),

  // Pause campaign (DB + platform API)
  pause: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });

      // Call platform API if we have an externalId
      if (campaign.externalId) {
        try {
          if (campaign.platform === 'GOOGLE') {
            const creds = getGoogleAdsCreds();
            if (creds) await pauseGoogleAdsCampaign(creds, campaign.externalId);
          } else if (campaign.platform === 'META') {
            const creds = getMetaAdsCreds();
            if (creds) await pauseMetaCampaign(campaign.externalId, creds.accessToken);
          }
        } catch (err) {
          logger.error({ err, campaignId: input.id }, 'Platform pause failed — updating DB only');
        }
      }

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: { status: 'PAUSED' },
      });
    }),

  // Resume campaign (DB + platform API)
  resume: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });

      if (campaign.externalId) {
        try {
          if (campaign.platform === 'GOOGLE') {
            const creds = getGoogleAdsCreds();
            if (creds) await resumeGoogleAdsCampaign(creds, campaign.externalId);
          } else if (campaign.platform === 'META') {
            const creds = getMetaAdsCreds();
            if (creds) await resumeMetaCampaign(campaign.externalId, creds.accessToken);
          }
        } catch (err) {
          logger.error({ err, campaignId: input.id }, 'Platform resume failed — updating DB only');
        }
      }

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: { status: 'ACTIVE' },
      });
    }),

  // Update campaign budget (DB + platform API)
  updateBudget: protectedProcedure
    .input(z.object({ id: z.string().cuid(), dailyBudgetPaisa: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });

      if (campaign.externalId) {
        try {
          if (campaign.platform === 'GOOGLE') {
            const creds = getGoogleAdsCreds();
            // Google Ads budgets require the budget resource name — stored as externalId on Campaign.targeting.budgetResourceName
            const targeting = campaign.targeting as Record<string, unknown> | null;
            const budgetResourceName = targeting?.budgetResourceName as string | undefined;
            if (creds && budgetResourceName) {
              // Convert paisa → micros: 1 paisa = 10,000 micros
              await updateGoogleAdsCampaignBudget(creds, budgetResourceName, input.dailyBudgetPaisa * 10_000);
            }
          } else if (campaign.platform === 'META') {
            const creds = getMetaAdsCreds();
            if (creds) await updateMetaCampaignBudget(campaign.externalId, creds.accessToken, input.dailyBudgetPaisa);
          }
        } catch (err) {
          logger.error({ err, campaignId: input.id }, 'Platform budget update failed — updating DB only');
        }
      }

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: { dailyBudget: input.dailyBudgetPaisa },
      });
    }),

  // Get campaign metrics (with Redis cache)
  getMetrics: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        range: z.enum(['7d', '30d', '90d']).default('30d'),
      })
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `metrics:campaign:${input.id}:${input.range}`;
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return cached;

      const days = input.range === '7d' ? 7 : input.range === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const allocations = await ctx.prisma.budgetAllocation.findMany({
        where: { campaignId: input.id, date: { gte: since } },
        orderBy: { date: 'asc' },
      });

      const result = {
        campaignId: input.id,
        range: input.range,
        allocations,
        totals: {
          spend: allocations.reduce((s: number, a: { spend: number }) => s + a.spend, 0),
          impressions: allocations.reduce((s: number, a: { impressions: number }) => s + a.impressions, 0),
          clicks: allocations.reduce((s: number, a: { clicks: number }) => s + a.clicks, 0),
          conversions: allocations.reduce((s: number, a: { conversions: number }) => s + a.conversions, 0),
          avgRoas: allocations.length
            ? allocations.reduce((s: number, a: { roas: number }) => s + a.roas, 0) / allocations.length
            : 0,
        },
        fetchedAt: new Date(),
      };

      await setCached(cacheKey, result, CACHE_TTL.METRICS_10MIN);
      return result;
    }),

  // Launch a 7-day performance forecast using Claude Sonnet
  launchForecast: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      proposedBudgetPaisa: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cacheKey = `forecast:campaign:${input.id}:${input.proposedBudgetPaisa ?? 'current'}`;
      const cached = await getCached<unknown>(cacheKey);
      if (cached) return cached;

      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          budgetAllocations: {
            orderBy: { date: 'desc' },
            take: 30,
          },
          leads: {
            select: { status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
          },
        },
      });

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });

      // Build metrics summary for Claude
      const recentAllocations = campaign.budgetAllocations;
      const avgRoas = recentAllocations.length
        ? recentAllocations.reduce((s: number, a: { roas: number }) => s + a.roas, 0) / recentAllocations.length
        : 0;
      const avgDailySpend = recentAllocations.length
        ? recentAllocations.reduce((s: number, a: { spend: number }) => s + a.spend, 0) / recentAllocations.length
        : 0;
      const avgDailyLeads = campaign.leads.length / 30;
      const enrollmentRate = campaign.leads.filter((l: { status: string }) => l.status === 'ENROLLED').length / Math.max(campaign.leads.length, 1);

      const prompt = `You are a performance marketing analyst for Omkar AI Innovation, an AI training company in India.
Analyze the following ad campaign data and provide a 7-day performance forecast.

Campaign: ${campaign.name}
Platform: ${campaign.platform}
Objective: ${campaign.objective}
Current Daily Budget: ₹${(campaign.dailyBudget / 100).toFixed(2)}
Proposed Daily Budget: ₹${((input.proposedBudgetPaisa ?? campaign.dailyBudget) / 100).toFixed(2)}

30-Day Historical Performance:
- Average Daily Spend: ₹${(avgDailySpend / 100).toFixed(2)}
- Average ROAS: ${avgRoas.toFixed(2)}x
- Average Daily Leads: ${avgDailyLeads.toFixed(1)}
- Workshop Enrollment Rate: ${(enrollmentRate * 100).toFixed(1)}%

Provide a JSON response with this exact structure:
{
  "projectedLeads": number,
  "projectedSpendPaisa": number,
  "projectedRoas": number,
  "projectedEnrollments": number,
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "keyInsights": string[],
  "recommendations": string[],
  "risks": string[]
}`;

      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });

        const content = message.content[0];
        if (content?.type !== 'text') throw new Error('Unexpected Claude response type');

        // Extract JSON from the response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in Claude response');

        const forecast = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const result = {
          campaignId: input.id,
          forecast,
          proposedBudgetPaisa: input.proposedBudgetPaisa ?? campaign.dailyBudget,
          generatedAt: new Date(),
        };

        await setCached(cacheKey, result, CACHE_TTL.FORECAST_1HR);
        return result;
      } catch (err) {
        logger.error({ err, campaignId: input.id }, 'Forecast generation failed');
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Forecast generation failed' });
      }
    }),
});
