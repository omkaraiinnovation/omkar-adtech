/**
 * Unit tests for the unified metrics normalizer
 * Tests: Google Ads micros → paisa, Meta string → paisa, aggregation helpers
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeGoogleAdsMetrics,
  normalizeMetaAdsMetrics,
  aggregateMetrics,
  type NormalizedDailyMetrics,
} from '../lib/normalizer';
import type { GoogleAdsCampaignMetrics } from '../lib/google-ads';
import type { MetaAdsCampaignInsight } from '../lib/meta-ads';

// ---------------------------------------------------------------------------
// Google Ads normalizer tests
// ---------------------------------------------------------------------------

describe('normalizeGoogleAdsMetrics', () => {
  const googleMetrics: GoogleAdsCampaignMetrics = {
    campaignId: 'campaign_001',
    date: '2025-01-15',
    impressions: 10000,
    clicks: 250,
    costMicros: 50_000_000_000, // 50,000 INR = 50,000,00 paisa = 50,00,00,000 micros?
    // Actually: 50,000 INR = 5,000,000 paisa → micros = 5,000,000 * 10,000 = 50,000,000,000
    conversions: 5,
    conversionValue: 250000, // 2,50,000 INR
    ctr: 0.025,
    averageCpc: 200_000_000, // 200 INR per click
    roas: 5.0,
  };

  it('converts costMicros to paisa correctly', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    // 50,000,000,000 micros / 10,000 = 5,000,000 paisa = ₹50,000
    expect(result.spendPaisa).toBe(5_000_000);
  });

  it('converts averageCpc micros to paisa correctly', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    // 200,000,000 micros / 10,000 = 20,000 paisa = ₹200
    expect(result.cpcPaisa).toBe(20_000);
  });

  it('converts conversionValue INR to paisa correctly', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    // 250,000 INR * 100 = 25,000,000 paisa
    expect(result.conversionValuePaisa).toBe(25_000_000);
  });

  it('preserves impressions and clicks', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    expect(result.impressions).toBe(10000);
    expect(result.clicks).toBe(250);
  });

  it('sets platform to GOOGLE', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    expect(result.platform).toBe('GOOGLE');
  });

  it('preserves date', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    expect(result.date).toBe('2025-01-15');
  });

  it('calculates ROAS from conversionValuePaisa / spendPaisa', () => {
    const result = normalizeGoogleAdsMetrics(googleMetrics);
    // ROAS = 25,000,000 / 5,000,000 = 5.0
    expect(result.roas).toBe(5.0);
  });

  it('returns zero ROAS when spend is zero', () => {
    const zeroSpend = { ...googleMetrics, costMicros: 0 };
    const result = normalizeGoogleAdsMetrics(zeroSpend);
    expect(result.roas).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Meta Ads normalizer tests
// ---------------------------------------------------------------------------

describe('normalizeMetaAdsMetrics', () => {
  const metaInsight: MetaAdsCampaignInsight = {
    campaign_id: 'meta_camp_001',
    campaign_name: 'Test Campaign',
    date_start: '2025-01-15',
    date_stop: '2025-01-15',
    impressions: '8500',
    clicks: '180',
    spend: '5000.00',     // ₹5,000
    ctr: '2.12',           // 2.12% (Meta returns %)
    cpc: '27.78',          // ₹27.78
    frequency: '1.5',
    reach: '5667',
    actions: [
      { action_type: 'lead', value: '8' },
      { action_type: 'video_view', value: '120' },
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '2' },
    ],
    action_values: [
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '15000.00' },
    ],
  };

  it('converts spend string to paisa', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    // "5000.00" * 100 = 500,000 paisa = ₹5,000
    expect(result.spendPaisa).toBe(500_000);
  });

  it('converts CPC string to paisa', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    // "27.78" * 100 = 2778 paisa
    expect(result.cpcPaisa).toBe(2778);
  });

  it('converts CTR percentage to decimal', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    // "2.12" / 100 = 0.0212
    expect(result.ctr).toBeCloseTo(0.0212, 4);
  });

  it('sums lead conversions from actions', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    // lead(8) + offsite_conversion.fb_pixel_lead(2) = 10
    expect(result.conversions).toBe(10);
  });

  it('converts action_values purchase to paisa', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    // 15000.00 * 100 = 1,500,000 paisa
    expect(result.conversionValuePaisa).toBe(1_500_000);
  });

  it('parses impressions and clicks as numbers', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    expect(result.impressions).toBe(8500);
    expect(result.clicks).toBe(180);
  });

  it('sets platform to META', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    expect(result.platform).toBe('META');
  });

  it('includes frequency and reach', () => {
    const result = normalizeMetaAdsMetrics(metaInsight);
    expect(result.frequency).toBeCloseTo(1.5);
    expect(result.reach).toBe(5667);
  });

  it('handles empty actions array', () => {
    const noActions = { ...metaInsight, actions: [], action_values: [] };
    const result = normalizeMetaAdsMetrics(noActions);
    expect(result.conversions).toBe(0);
    expect(result.conversionValuePaisa).toBe(0);
    expect(result.roas).toBe(0);
  });

  it('handles missing spend gracefully', () => {
    const noSpend = { ...metaInsight, spend: '' };
    const result = normalizeMetaAdsMetrics(noSpend);
    expect(result.spendPaisa).toBe(0);
    expect(result.roas).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Aggregate metrics tests
// ---------------------------------------------------------------------------

describe('aggregateMetrics', () => {
  const sampleMetrics: NormalizedDailyMetrics[] = [
    {
      date: '2025-01-13',
      platform: 'GOOGLE',
      externalCampaignId: 'c1',
      impressions: 5000,
      clicks: 100,
      spendPaisa: 100_000,
      conversions: 3,
      conversionValuePaisa: 600_000,
      ctr: 0.02,
      cpcPaisa: 1000,
      roas: 6.0,
    },
    {
      date: '2025-01-14',
      platform: 'GOOGLE',
      externalCampaignId: 'c1',
      impressions: 6000,
      clicks: 120,
      spendPaisa: 120_000,
      conversions: 4,
      conversionValuePaisa: 720_000,
      ctr: 0.02,
      cpcPaisa: 1000,
      roas: 6.0,
    },
  ];

  it('sums spend, impressions, clicks, conversions', () => {
    const agg = aggregateMetrics(sampleMetrics);
    expect(agg.totalSpendPaisa).toBe(220_000);
    expect(agg.totalImpressions).toBe(11000);
    expect(agg.totalClicks).toBe(220);
    expect(agg.totalConversions).toBe(7);
  });

  it('calculates avgCtr from totals', () => {
    const agg = aggregateMetrics(sampleMetrics);
    // 220 clicks / 11000 impressions = 0.02
    expect(agg.avgCtr).toBeCloseTo(0.02, 4);
  });

  it('calculates avgCpc from totals', () => {
    const agg = aggregateMetrics(sampleMetrics);
    // 220,000 paisa / 220 clicks = 1000 paisa per click
    expect(agg.avgCpc).toBe(1000);
  });

  it('calculates avgRoas as mean of daily ROAS', () => {
    const agg = aggregateMetrics(sampleMetrics);
    // (6.0 + 6.0) / 2 = 6.0
    expect(agg.avgRoas).toBe(6.0);
  });

  it('returns zeros for empty array', () => {
    const agg = aggregateMetrics([]);
    expect(agg.totalSpendPaisa).toBe(0);
    expect(agg.avgRoas).toBe(0);
    expect(agg.avgCtr).toBe(0);
  });

  it('handles zero impressions without dividing by zero', () => {
    const noImpressions = [{ ...sampleMetrics[0]!, impressions: 0, clicks: 0 }];
    const agg = aggregateMetrics(noImpressions);
    expect(agg.avgCtr).toBe(0);
  });
});
