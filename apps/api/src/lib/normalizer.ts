/**
 * Unified metrics normalizer
 * Converts Google Ads and Meta Ads platform-specific metrics into a
 * canonical NormalizedMetrics record stored in BudgetAllocation.
 *
 * Currency convention: all monetary values stored as INR paisa (integer).
 * Google Ads returns micros (INR). Meta returns INR string.
 */

import type { GoogleAdsCampaignMetrics } from './google-ads';
import type { MetaAdsCampaignInsight } from './meta-ads';

// ---------------------------------------------------------------------------
// Canonical types
// ---------------------------------------------------------------------------

export interface NormalizedDailyMetrics {
  date: string;           // YYYY-MM-DD
  platform: 'GOOGLE' | 'META';
  externalCampaignId: string;
  impressions: number;
  clicks: number;
  spendPaisa: number;     // INR paisa
  conversions: number;
  conversionValuePaisa: number;
  ctr: number;            // 0–1 decimal
  cpcPaisa: number;       // cost per click in paisa
  roas: number;           // dimensionless
  frequency?: number;     // Meta only
  reach?: number;         // Meta only
}

// ---------------------------------------------------------------------------
// Google Ads normalizer
// Google Ads amounts are in micros of the account currency (INR)
// 1 INR = 1,000,000 micros → 1 INR = 100 paisa → 1 micro = 0.0001 paisa
// So: paisa = micros / 10_000
// ---------------------------------------------------------------------------

export function normalizeGoogleAdsMetrics(
  metrics: GoogleAdsCampaignMetrics
): NormalizedDailyMetrics {
  const spendPaisa = Math.round(metrics.costMicros / 10_000);
  const conversionValuePaisa = Math.round(metrics.conversionValue * 100); // API returns INR decimal
  const cpcPaisa = Math.round(metrics.averageCpc / 10_000);
  const roas = spendPaisa > 0 ? conversionValuePaisa / spendPaisa : 0;

  return {
    date: metrics.date,
    platform: 'GOOGLE',
    externalCampaignId: metrics.campaignId,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    spendPaisa,
    conversions: metrics.conversions,
    conversionValuePaisa,
    ctr: metrics.ctr,
    cpcPaisa,
    roas: Math.round(roas * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Meta Ads normalizer
// Meta returns spend as an INR decimal string (e.g., "1234.56")
// ---------------------------------------------------------------------------

export function normalizeMetaAdsMetrics(
  insight: MetaAdsCampaignInsight
): NormalizedDailyMetrics {
  const spendPaisa = Math.round(parseFloat(insight.spend || '0') * 100);
  const cpcPaisa = Math.round(parseFloat(insight.cpc || '0') * 100);
  const ctr = parseFloat(insight.ctr || '0') / 100; // Meta returns percent string e.g. "2.5"

  // Extract conversions from actions array
  const conversions = (insight.actions ?? [])
    .filter((a) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead')
    .reduce((sum, a) => sum + Number(a.value), 0);

  // Extract conversion value
  const conversionValuePaisa = Math.round(
    (insight.action_values ?? [])
      .filter((a) => a.action_type === 'offsite_conversion.fb_pixel_purchase')
      .reduce((sum, a) => sum + parseFloat(a.value), 0) * 100
  );

  const roas = spendPaisa > 0 ? conversionValuePaisa / spendPaisa : 0;

  return {
    date: insight.date_start,
    platform: 'META',
    externalCampaignId: insight.campaign_id,
    impressions: Number(insight.impressions || 0),
    clicks: Number(insight.clicks || 0),
    spendPaisa,
    conversions,
    conversionValuePaisa,
    ctr,
    cpcPaisa,
    roas: Math.round(roas * 100) / 100,
    frequency: parseFloat(insight.frequency || '0'),
    reach: Number(insight.reach || 0),
  };
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

export function aggregateMetrics(metrics: NormalizedDailyMetrics[]): {
  totalSpendPaisa: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgRoas: number;
} {
  if (metrics.length === 0) {
    return {
      totalSpendPaisa: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      avgCtr: 0,
      avgCpc: 0,
      avgRoas: 0,
    };
  }

  const totalSpendPaisa = metrics.reduce((s, m) => s + m.spendPaisa, 0);
  const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
  const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgCpc = totalClicks > 0 ? totalSpendPaisa / totalClicks : 0;
  const avgRoas =
    metrics.reduce((s, m) => s + m.roas, 0) / metrics.length;

  return {
    totalSpendPaisa,
    totalImpressions,
    totalClicks,
    totalConversions,
    avgCtr: Math.round(avgCtr * 10_000) / 10_000,
    avgCpc: Math.round(avgCpc),
    avgRoas: Math.round(avgRoas * 100) / 100,
  };
}
