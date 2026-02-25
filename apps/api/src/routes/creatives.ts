import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

export const creativesRouter = router({
  // Get all creatives across all campaigns for the authenticated user
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'DEPLOYED']).optional(),
        campaignId: z.string().cuid().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Get all ad sets for user's campaigns
      const user = await ctx.prisma.user.findUnique({ where: { clerkId: ctx.clerkUserId } });
      if (!user) return [];

      const adSets = await ctx.prisma.adSet.findMany({
        where: {
          campaign: {
            userId: user.id,
            ...(input?.campaignId && { id: input.campaignId }),
          },
        },
        select: { id: true },
      });
      const adSetIds = adSets.map((a: { id: string }) => a.id);

      return ctx.prisma.creative.findMany({
        where: {
          adSetId: { in: adSetIds },
          ...(input?.status && { status: input.status }),
        },
        include: {
          complianceAudits: { orderBy: { createdAt: 'desc' }, take: 1 },
          adSet: { select: { campaignId: true, campaign: { select: { name: true, platform: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 100,
      });
    }),

  // Get all creatives for an ad set
  getByAdSet: protectedProcedure
    .input(z.object({ adSetId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const creatives = await ctx.prisma.creative.findMany({
        where: { adSetId: input.adSetId },
        include: {
          complianceAudits: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      });
      return creatives;
    }),

  // Get creative by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const creative = await ctx.prisma.creative.findUnique({
        where: { id: input.id },
        include: { complianceAudits: { orderBy: { createdAt: 'desc' } } },
      });
      if (!creative) throw new TRPCError({ code: 'NOT_FOUND', message: 'Creative not found' });
      return creative;
    }),

  // Create creative (manually or AI-generated)
  create: protectedProcedure
    .input(
      z.object({
        adSetId: z.string().cuid(),
        headline: z.string().min(1).max(90),
        description: z.string().min(1).max(200),
        imageUrl: z.string().url().optional(),
        videoUrl: z.string().url().optional(),
        format: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'RSA', 'RESPONSIVE_DISPLAY']),
        generativeModel: z.string().optional(),
        generativePrompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const creative = await ctx.prisma.creative.create({ data: input });
      return creative;
    }),

  // Update creative status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'DEPLOYED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const creative = await ctx.prisma.creative.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      return creative;
    }),

  // Get compliance audit history for a creative
  getAudits: protectedProcedure
    .input(z.object({ creativeId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const audits = await ctx.prisma.complianceAudit.findMany({
        where: { creativeId: input.creativeId },
        orderBy: { createdAt: 'desc' },
      });
      return audits;
    }),
});
