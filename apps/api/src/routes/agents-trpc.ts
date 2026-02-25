import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { logger } from '../lib/logger';

export const agentsRouter = router({
  // Trigger the 6-agent creative pipeline for a campaign
  runCreativePipeline: protectedProcedure
    .input(z.object({
      campaignId: z.string().cuid(),
      targetAudience: z.string().min(1),
      product: z.string().min(1),
      usp: z.string().min(1),
      brandVoice: z.string().default('Professional, authoritative, inspiring'),
      cta: z.string().default('Register Now'),
      landingPageUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });

      // Log the start
      const runLog = await ctx.prisma.agentLog.create({
        data: {
          agentName: 'AdTechPipeline',
          action: 'run_creative_pipeline',
          inputJson: input as object,
          outputJson: null,
          status: 'RUNNING',
          ms: 0,
        },
      });

      // Run pipeline asynchronously (don't await — return immediately)
      const { runAdTechPipeline } = await import('../agents/pipeline');

      setImmediate(async () => {
        const start = Date.now();
        try {
          const result = await runAdTechPipeline({
            campaignId: input.campaignId,
            campaignName: campaign.name,
            platform: campaign.platform,
            objective: campaign.objective,
            targetAudience: input.targetAudience,
            product: input.product,
            usp: input.usp,
            budget: campaign.dailyBudget,
            brandVoice: input.brandVoice,
            cta: input.cta,
            ...(input.landingPageUrl && { landingPageUrl: input.landingPageUrl }),
          });

          await ctx.prisma.agentLog.update({
            where: { id: runLog.id },
            data: {
              outputJson: result as object,
              status: result.success ? 'SUCCESS' : 'FAILED',
              ms: result.durationMs,
            },
          });
        } catch (err) {
          logger.error({ err }, 'Pipeline run failed');
          await ctx.prisma.agentLog.update({
            where: { id: runLog.id },
            data: {
              status: 'FAILED',
              ms: Date.now() - start,
              errorMessage: String(err),
            },
          });
        }
      });

      return { runId: runLog.id, status: 'RUNNING' };
    }),

  // Get pipeline run status by log ID
  getPipelineStatus: protectedProcedure
    .input(z.object({ runId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const log = await ctx.prisma.agentLog.findUnique({ where: { id: input.runId } });
      if (!log) throw new TRPCError({ code: 'NOT_FOUND', message: 'Run not found' });
      return log;
    }),


  // Get agent logs
  getLogs: protectedProcedure
    .input(
      z.object({
        agentName: z.string().optional(),
        status: z.enum(['RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED']).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.prisma.agentLog.findMany({
        where: {
          ...(input?.agentName && { agentName: input.agentName }),
          ...(input?.status && { status: input.status }),
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 100,
      });
      return logs;
    }),

  // Get agent performance stats
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [total, success, failed, avgMs] = await Promise.all([
        ctx.prisma.agentLog.count(),
        ctx.prisma.agentLog.count({ where: { status: 'SUCCESS' } }),
        ctx.prisma.agentLog.count({ where: { status: 'FAILED' } }),
        ctx.prisma.agentLog.aggregate({ _avg: { ms: true } }),
      ]);

      const agentBreakdown = await ctx.prisma.agentLog.groupBy({
        by: ['agentName', 'status'],
        _count: { id: true },
        orderBy: { agentName: 'asc' },
      });

      return {
        total,
        success,
        failed,
        successRate: total > 0 ? Math.round((success / total) * 100) : 0,
        avgMs: Math.round(avgMs._avg.ms ?? 0),
        agentBreakdown,
      };
    }),
});
