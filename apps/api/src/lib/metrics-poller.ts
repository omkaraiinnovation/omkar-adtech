/**
 * Metrics poller — runs every 15 minutes to pull fresh data from
 * Google Ads v17 and Meta Graph API v20.0, normalize it, and upsert
 * into BudgetAllocation rows.
 *
 * Triggered by: setInterval on server start (non-serverless)
 * Also exportable for Railway cron job (separate process)
 */

import { prisma } from './prisma';
import { redis, setCached, CACHE_TTL } from './redis';
import { logger } from './logger';
import {
  getGoogleAdsCreds,
  getGoogleAdsCampaignMetrics,
  listGoogleAdsCampaigns,
} from './google-ads';
import {
  getMetaAdsCreds,
  getMetaCampaignInsights,
  listMetaCampaigns,
} from './meta-ads';
import {
  normalizeGoogleAdsMetrics,
  normalizeMetaAdsMetrics,
  type NormalizedDailyMetrics,
} from './normalizer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Upsert normalized metrics into BudgetAllocation
// ---------------------------------------------------------------------------

async function upsertMetrics(
  campaignId: string,
  metrics: NormalizedDailyMetrics[]
): Promise<void> {
  for (const m of metrics) {
    const date = new Date(m.date);

    await prisma.budgetAllocation.upsert({
      where: {
        // Composite unique: campaignId + date
        campaignId_date: { campaignId, date },
      },
      create: {
        campaignId,
        date,
        platform: m.platform,
        allocated: m.spendPaisa, // actual spend as proxy for allocation
        spend: m.spendPaisa,
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        roas: m.roas,
        ucbScore: 0,
      },
      update: {
        spend: m.spendPaisa,
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        roas: m.roas,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Sync Google Ads campaigns
// ---------------------------------------------------------------------------

async function syncGoogleAdsCampaigns(): Promise<number> {
  const creds = getGoogleAdsCreds();
  if (!creds) {
    logger.warn('Google Ads credentials not configured — skipping sync');
    return 0;
  }

  let synced = 0;

  // Get all active Google campaigns from our DB
  const dbCampaigns = await prisma.campaign.findMany({
    where: { platform: 'GOOGLE', status: 'ACTIVE', externalId: { not: null } },
    select: { id: true, externalId: true },
  });

  const startDate = toDateString(daysAgo(2)); // pull last 2 days to catch delayed updates
  const endDate = toDateString(new Date());

  for (const campaign of dbCampaigns) {
    if (!campaign.externalId) continue;

    try {
      const metrics = await getGoogleAdsCampaignMetrics(
        creds,
        campaign.externalId,
        startDate,
        endDate
      );

      const normalized = metrics.map(normalizeGoogleAdsMetrics);
      await upsertMetrics(campaign.id, normalized);

      // Invalidate Redis metrics cache for this campaign
      await redis.del(`metrics:campaign:${campaign.id}:7d`);
      await redis.del(`metrics:campaign:${campaign.id}:30d`);
      await redis.del(`metrics:campaign:${campaign.id}:90d`);

      synced += normalized.length;
    } catch (err) {
      logger.error({ err, campaignId: campaign.id }, 'Failed to sync Google Ads metrics');
    }
  }

  logger.info({ synced, campaigns: dbCampaigns.length }, 'Google Ads sync complete');
  return synced;
}

// ---------------------------------------------------------------------------
// Sync Meta Ads campaigns
// ---------------------------------------------------------------------------

async function syncMetaAdsCampaigns(): Promise<number> {
  const creds = getMetaAdsCreds();
  if (!creds) {
    logger.warn('Meta Ads credentials not configured — skipping sync');
    return 0;
  }

  let synced = 0;

  const dbCampaigns = await prisma.campaign.findMany({
    where: { platform: 'META', status: 'ACTIVE', externalId: { not: null } },
    select: { id: true, externalId: true },
  });

  const startDate = toDateString(daysAgo(2));
  const endDate = toDateString(new Date());

  for (const campaign of dbCampaigns) {
    if (!campaign.externalId) continue;

    try {
      const insights = await getMetaCampaignInsights(
        creds.adAccountId,
        creds.accessToken,
        campaign.externalId,
        startDate,
        endDate
      );

      const normalized = insights.map(normalizeMetaAdsMetrics);
      await upsertMetrics(campaign.id, normalized);

      // Invalidate Redis cache
      await redis.del(`metrics:campaign:${campaign.id}:7d`);
      await redis.del(`metrics:campaign:${campaign.id}:30d`);
      await redis.del(`metrics:campaign:${campaign.id}:90d`);

      synced += normalized.length;
    } catch (err) {
      logger.error({ err, campaignId: campaign.id }, 'Failed to sync Meta Ads metrics');
    }
  }

  logger.info({ synced, campaigns: dbCampaigns.length }, 'Meta Ads sync complete');
  return synced;
}

// ---------------------------------------------------------------------------
// Sync platform campaign list (discover new campaigns)
// ---------------------------------------------------------------------------

async function syncCampaignList(): Promise<void> {
  // Google Ads — discover campaigns not in our DB
  const googleCreds = getGoogleAdsCreds();
  if (googleCreds) {
    try {
      const googleCampaigns = await listGoogleAdsCampaigns(googleCreds);

      for (const gc of googleCampaigns) {
        const existing = await prisma.campaign.findFirst({
          where: { externalId: gc.id, platform: 'GOOGLE' },
        });

        if (!existing) {
          logger.info({ campaignId: gc.id, name: gc.name }, 'Discovered new Google Ads campaign');
          // Campaign discovery is logged — user must onboard it via the dashboard UI
        } else {
          // Update status to keep in sync
          const mapped: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' =
            gc.status === 'ENABLED' ? 'ACTIVE' :
            gc.status === 'PAUSED' ? 'PAUSED' : 'ARCHIVED';

          if (existing.status !== mapped) {
            await prisma.campaign.update({
              where: { id: existing.id },
              data: { status: mapped },
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to sync Google Ads campaign list');
    }
  }

  // Meta Ads — discover campaigns
  const metaCreds = getMetaAdsCreds();
  if (metaCreds) {
    try {
      const metaCampaigns = await listMetaCampaigns(metaCreds.adAccountId, metaCreds.accessToken);

      for (const mc of metaCampaigns) {
        const existing = await prisma.campaign.findFirst({
          where: { externalId: mc.id, platform: 'META' },
        });

        if (!existing) {
          logger.info({ campaignId: mc.id, name: mc.name }, 'Discovered new Meta campaign');
        } else {
          const mapped: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' =
            mc.status === 'ACTIVE' ? 'ACTIVE' :
            mc.status === 'PAUSED' ? 'PAUSED' : 'ARCHIVED';

          if (existing.status !== mapped) {
            await prisma.campaign.update({
              where: { id: existing.id },
              data: { status: mapped },
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to sync Meta campaign list');
    }
  }
}

// ---------------------------------------------------------------------------
// Main poll function — called by the scheduler
// ---------------------------------------------------------------------------

let isRunning = false;

export async function pollMetrics(): Promise<void> {
  if (isRunning) {
    logger.warn('Metrics poll already in progress — skipping');
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    logger.info('Starting metrics poll...');

    // Run syncs in parallel
    const [googleSynced, metaSynced] = await Promise.allSettled([
      syncGoogleAdsCampaigns(),
      syncMetaAdsCampaigns(),
    ]);

    // Also sync campaign list (status updates)
    await syncCampaignList();

    // Invalidate all dashboard caches so next request pulls fresh data
    const dashboardKeys = await redis.keys('dashboard:overview:*');
    if (dashboardKeys.length > 0) {
      await redis.del(...dashboardKeys);
    }

    const elapsed = Date.now() - start;
    logger.info(
      {
        elapsed,
        googleRows: googleSynced.status === 'fulfilled' ? googleSynced.value : 0,
        metaRows: metaSynced.status === 'fulfilled' ? metaSynced.value : 0,
      },
      'Metrics poll complete'
    );

    // Store last successful poll time
    await setCached('metrics:last_poll', new Date().toISOString(), CACHE_TTL.FORECAST_1HR);
  } catch (err) {
    logger.error({ err }, 'Metrics poll failed');
  } finally {
    isRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Scheduler — start 15-minute interval
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startMetricsPoller(): NodeJS.Timeout {
  logger.info('Metrics poller started (15-min interval)');

  // Run immediately on startup (after a short delay for DB connections)
  const initialDelay = setTimeout(() => pollMetrics(), 10_000);

  const interval = setInterval(() => pollMetrics(), POLL_INTERVAL_MS);

  // Cleanup on process exit
  process.on('SIGTERM', () => {
    clearTimeout(initialDelay);
    clearInterval(interval);
  });

  return interval;
}
