import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { getMetaAdsCreds, sendMetaCAPIEvents, hashForCAPI, type MetaCAPIEvent } from '../lib/meta-ads';
import { logger } from '../lib/logger';

export const leadsRouter = router({
  // Get all leads with filters
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().cuid().optional(),
        status: z.enum(['NEW', 'QUALIFYING', 'QUALIFIED', 'ATTENDING', 'ENROLLED', 'LOST']).optional(),
        source: z.enum(['META', 'GOOGLE']).optional(),
        search: z.string().optional(), // Search by name, phone, email
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const leads = await ctx.prisma.lead.findMany({
        where: {
          ...(input?.campaignId && { campaignId: input.campaignId }),
          ...(input?.status && { status: input.status }),
          ...(input?.source && { source: input.source }),
          ...(input?.search && {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { phone: { contains: input.search } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }),
        },
        include: {
          campaign: { select: { name: true, platform: true } },
          conversation: true,
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 100,
        skip: input?.offset ?? 0,
      });

      return leads;
    }),

  // Get lead by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.findUnique({
        where: { id: input.id },
        include: {
          campaign: true,
          conversation: true,
        },
      });

      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });
      return lead;
    }),

  // Update lead status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: z.enum(['NEW', 'QUALIFYING', 'QUALIFIED', 'ATTENDING', 'ENROLLED', 'LOST']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      return lead;
    }),

  // Get lead pipeline counts (for Kanban headers)
  getPipelineCounts: protectedProcedure
    .input(z.object({ campaignId: z.string().cuid().optional() }))
    .query(async ({ ctx, input }) => {
      const statuses = ['NEW', 'QUALIFYING', 'QUALIFIED', 'ATTENDING', 'ENROLLED', 'LOST'] as const;

      const counts = await Promise.all(
        statuses.map(async (status) => {
          const count = await ctx.prisma.lead.count({
            where: {
              status,
              ...(input.campaignId && { campaignId: input.campaignId }),
            },
          });
          return { status, count };
        })
      );

      return Object.fromEntries(counts.map(({ status, count }) => [status, count]));
    }),

  // Send enrollment event to Meta CAPI (called when lead is marked ENROLLED)
  sendEnrollmentCAPI: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.prisma.lead.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { platform: true } } },
      });

      if (!lead) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead not found' });

      const creds = getMetaAdsCreds();
      if (!creds) {
        logger.warn('Meta CAPI credentials not configured — skipping enrollment event');
        return { sent: false, reason: 'Meta credentials not configured' };
      }

      const event: MetaCAPIEvent = {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'crm',
        user_data: {
          ...(lead.phone && { ph: [hashForCAPI(lead.phone)] }),
          ...(lead.email && { em: [hashForCAPI(lead.email)] }),
          ...(lead.city && { ct: [hashForCAPI(lead.city)] }),
          external_id: hashForCAPI(lead.id),
        },
        custom_data: {
          lead_event_source: 'omkar_adtech_crm',
          ...(lead.campaign?.platform === 'META' && { content_name: 'Workshop Enrollment' }),
        },
        event_id: `enroll_${lead.id}_${Date.now()}`,
      };

      try {
        const result = await sendMetaCAPIEvents(creds.pixelId, creds.accessToken, [event]);
        logger.info({ leadId: lead.id, eventsReceived: result.events_received }, 'Enrollment CAPI event sent');
        return { sent: true, eventsReceived: result.events_received };
      } catch (err) {
        logger.error({ err, leadId: lead.id }, 'Failed to send enrollment CAPI event');
        return { sent: false, reason: String(err) };
      }
    }),

  // Get leads for Kanban board (grouped by status)
  getKanban: protectedProcedure
    .input(z.object({ campaignId: z.string().cuid().optional() }))
    .query(async ({ ctx, input }) => {
      const leads = await ctx.prisma.lead.findMany({
        where: {
          ...(input.campaignId && { campaignId: input.campaignId }),
        },
        include: {
          campaign: { select: { name: true, platform: true } },
          conversation: { select: { state: true, lastMsgAt: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      });

      // Group by status
      const grouped: Record<string, typeof leads> = {};
      for (const lead of leads) {
        if (!grouped[lead.status]) grouped[lead.status] = [];
        grouped[lead.status]!.push(lead);
      }

      return grouped;
    }),
});
