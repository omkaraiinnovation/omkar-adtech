/**
 * Google Ads API v17 integration
 * REST/gRPC REST → https://developers.google.com/google-ads/api/rest
 * OAuth2 using refresh token flow (service account not supported for personal accounts)
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string; // Without dashes: "1234567890"
  loginCustomerId?: string; // Manager account CID (optional)
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | 'UNKNOWN';
  advertisingChannelType: string;
  biddingStrategyType: string;
  startDate: string;
  endDate?: string;
  campaignBudget: {
    amountMicros: string; // INR micros
    deliveryMethod: string;
  };
}

export interface GoogleAdsCampaignMetrics {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number; // INR micros
  conversions: number;
  conversionValue: number;
  ctr: number;
  averageCpc: number;
  roas: number;
}

export interface GoogleAdsLeadFormSubmission {
  resourceName: string;
  adGroupAd: string;
  campaign: string;
  leadFormUserSubmissions: {
    userColumnData: Array<{ columnId: string; stringValue: string }>;
    submissionDateTime: string;
    isPartialSubmission: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// OAuth2 token management
// ---------------------------------------------------------------------------

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getGoogleAdsAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth2 token refresh failed: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  logger.info({ expiresIn: data.expires_in }, 'Google Ads access token refreshed');
  return cachedToken.accessToken;
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

const GOOGLE_ADS_BASE = 'https://googleads.googleapis.com/v17';

async function googleAdsRequest<T>(
  creds: GoogleAdsCredentials,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getGoogleAdsAccessToken(creds);

  const url = `${GOOGLE_ADS_BASE}/${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': creds.developerToken,
    'Content-Type': 'application/json',
    ...(creds.loginCustomerId && { 'login-customer-id': creds.loginCustomerId }),
  };

  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> | undefined) } });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body, path }, 'Google Ads API error');
    throw new Error(`Google Ads API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// GAQL query helper
// ---------------------------------------------------------------------------

async function gaqlSearch<T>(creds: GoogleAdsCredentials, query: string): Promise<T[]> {
  type SearchResponse = { results?: T[] };
  const data = await googleAdsRequest<SearchResponse>(
    creds,
    `customers/${creds.customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    }
  );
  return data.results ?? [];
}

// ---------------------------------------------------------------------------
// Campaign operations
// ---------------------------------------------------------------------------

export async function listGoogleAdsCampaigns(
  creds: GoogleAdsCredentials
): Promise<GoogleAdsCampaign[]> {
  type Row = { campaign: GoogleAdsCampaign };
  const results = await gaqlSearch<Row>(
    creds,
    `SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      campaign_budget.delivery_method
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.id ASC
    LIMIT 500`
  );

  return results.map((r) => r.campaign);
}

export async function pauseGoogleAdsCampaign(
  creds: GoogleAdsCredentials,
  campaignId: string
): Promise<void> {
  await googleAdsRequest(creds, `customers/${creds.customerId}/campaigns:mutate`, {
    method: 'POST',
    body: JSON.stringify({
      operations: [
        {
          updateMask: 'status',
          update: {
            resourceName: `customers/${creds.customerId}/campaigns/${campaignId}`,
            status: 'PAUSED',
          },
        },
      ],
    }),
  });
  logger.info({ campaignId }, 'Google Ads campaign paused');
}

export async function resumeGoogleAdsCampaign(
  creds: GoogleAdsCredentials,
  campaignId: string
): Promise<void> {
  await googleAdsRequest(creds, `customers/${creds.customerId}/campaigns:mutate`, {
    method: 'POST',
    body: JSON.stringify({
      operations: [
        {
          updateMask: 'status',
          update: {
            resourceName: `customers/${creds.customerId}/campaigns/${campaignId}`,
            status: 'ENABLED',
          },
        },
      ],
    }),
  });
  logger.info({ campaignId }, 'Google Ads campaign resumed');
}

export async function updateGoogleAdsCampaignBudget(
  creds: GoogleAdsCredentials,
  campaignBudgetResourceName: string,
  dailyBudgetMicros: number
): Promise<void> {
  await googleAdsRequest(creds, `customers/${creds.customerId}/campaignBudgets:mutate`, {
    method: 'POST',
    body: JSON.stringify({
      operations: [
        {
          updateMask: 'amountMicros',
          update: {
            resourceName: campaignBudgetResourceName,
            amountMicros: String(dailyBudgetMicros),
          },
        },
      ],
    }),
  });
  logger.info({ campaignBudgetResourceName, dailyBudgetMicros }, 'Google Ads budget updated');
}

// ---------------------------------------------------------------------------
// Metrics pull
// ---------------------------------------------------------------------------

export async function getGoogleAdsCampaignMetrics(
  creds: GoogleAdsCredentials,
  campaignId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<GoogleAdsCampaignMetrics[]> {
  type Row = {
    campaign: { id: string };
    segments: { date: string };
    metrics: {
      impressions: string;
      clicks: string;
      costMicros: string;
      conversions: string;
      conversionsValue: string;
      ctr: string;
      averageCpc: string;
    };
  };

  const results = await gaqlSearch<Row>(
    creds,
    `SELECT
      campaign.id,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.id = ${campaignId}
      AND segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date ASC`
  );

  return results.map((r) => {
    const costMicros = Number(r.metrics.costMicros ?? 0);
    const convValue = Number(r.metrics.conversionsValue ?? 0);
    const conversions = Number(r.metrics.conversions ?? 0);
    const roas = costMicros > 0 ? (convValue * 1_000_000) / costMicros : 0;

    return {
      campaignId: r.campaign.id,
      date: r.segments.date,
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
      costMicros,
      conversions,
      conversionValue: convValue,
      ctr: Number(r.metrics.ctr ?? 0),
      averageCpc: Number(r.metrics.averageCpc ?? 0),
      roas: Math.round(roas * 100) / 100,
    };
  });
}

// ---------------------------------------------------------------------------
// Lead Form Assets — poll every 15 minutes via cron
// ---------------------------------------------------------------------------

export async function getGoogleAdsLeadFormSubmissions(
  creds: GoogleAdsCredentials,
  campaignId: string,
  since: Date
): Promise<GoogleAdsLeadFormSubmission[]> {
  // Lead form asset submissions are fetched via the leadFormLeadService
  type Response = { leadFormLeads: GoogleAdsLeadFormSubmission[] };
  try {
    const data = await googleAdsRequest<Response>(
      creds,
      `customers/${creds.customerId}/leadFormLeads`,
      {
        method: 'GET',
      }
    );
    return data.leadFormLeads ?? [];
  } catch (err) {
    logger.warn({ err, campaignId }, 'Failed to fetch Google Ads lead form submissions');
    return [];
  }
}

// ---------------------------------------------------------------------------
// Credential builder from env
// ---------------------------------------------------------------------------

export function getGoogleAdsCreds(): GoogleAdsCredentials | null {
  const {
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  } = process.env;

  if (
    !GOOGLE_ADS_CLIENT_ID ||
    !GOOGLE_ADS_CLIENT_SECRET ||
    !GOOGLE_ADS_REFRESH_TOKEN ||
    !GOOGLE_ADS_DEVELOPER_TOKEN ||
    !GOOGLE_ADS_CUSTOMER_ID
  ) {
    return null;
  }

  return {
    clientId: GOOGLE_ADS_CLIENT_ID,
    clientSecret: GOOGLE_ADS_CLIENT_SECRET,
    refreshToken: GOOGLE_ADS_REFRESH_TOKEN,
    developerToken: GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ''),
    ...(GOOGLE_ADS_LOGIN_CUSTOMER_ID && { loginCustomerId: GOOGLE_ADS_LOGIN_CUSTOMER_ID }),
  };
}
