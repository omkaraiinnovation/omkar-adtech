/**
 * Meta Graph API v20.0 integration
 * https://developers.facebook.com/docs/marketing-api/reference
 * Handles: Campaigns, Ad Sets, Lead Ads, Conversions API (CAPI)
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaAdsCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  objective: string;
  daily_budget?: string; // INR paisa (string from API)
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
  updated_time: string;
}

export interface MetaAdsCampaignInsight {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  spend: string; // INR string
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  ctr: string;
  cpc: string;
  frequency: string;
  reach: string;
}

export interface MetaCAPIEvent {
  event_name:
    | 'Lead'
    | 'CompleteRegistration'
    | 'Purchase'
    | 'InitiateCheckout'
    | 'ViewContent'
    | 'Contact';
  event_time: number; // Unix timestamp
  action_source: 'website' | 'app' | 'phone_call' | 'crm';
  event_source_url?: string;
  user_data: {
    em?: string[]; // SHA-256 hashed email
    ph?: string[]; // SHA-256 hashed phone
    fn?: string[]; // SHA-256 hashed first name
    ln?: string[]; // SHA-256 hashed last name
    ct?: string[]; // SHA-256 hashed city
    st?: string[]; // SHA-256 hashed state
    zp?: string[]; // SHA-256 hashed zip
    country?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbp?: string; // Facebook browser pixel cookie
    fbc?: string; // Facebook click ID cookie
    external_id?: string; // Your CRM lead ID (hashed)
  };
  custom_data?: {
    currency?: string;
    value?: number;
    content_name?: string;
    content_category?: string;
    lead_event_source?: string;
  };
  event_id?: string; // Dedup key
}

export interface MetaLeadFormEntry {
  id: string;
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  created_time: string;
  field_data: Array<{ name: string; values: string[] }>;
  is_organic?: boolean;
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

const META_GRAPH_BASE = 'https://graph.facebook.com/v20.0';

async function metaRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}/${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body, path }, 'Meta Graph API error');
    throw new Error(`Meta API ${res.status}: ${body}`);
  }

  const data = await res.json() as { error?: { message: string } } & T;
  if (data.error) {
    throw new Error(`Meta API error: ${data.error.message}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Campaign operations
// ---------------------------------------------------------------------------

export async function listMetaCampaigns(
  adAccountId: string, // "act_1234567890"
  accessToken: string
): Promise<MetaAdsCampaign[]> {
  type Response = { data: MetaAdsCampaign[]; paging?: { next?: string } };

  const campaigns: MetaAdsCampaign[] = [];
  let nextUrl: string | undefined;

  const first = await metaRequest<Response>(
    `${adAccountId}/campaigns`,
    accessToken,
    {},
    {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time',
      limit: '500',
    }
  );

  campaigns.push(...first.data);
  nextUrl = first.paging?.next;

  // Paginate
  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;
    const page = await res.json() as Response;
    campaigns.push(...page.data);
    nextUrl = page.paging?.next;
  }

  return campaigns;
}

export async function pauseMetaCampaign(
  campaignId: string,
  accessToken: string
): Promise<void> {
  await metaRequest(
    campaignId,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ status: 'PAUSED' }),
    }
  );
  logger.info({ campaignId }, 'Meta campaign paused');
}

export async function resumeMetaCampaign(
  campaignId: string,
  accessToken: string
): Promise<void> {
  await metaRequest(
    campaignId,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ status: 'ACTIVE' }),
    }
  );
  logger.info({ campaignId }, 'Meta campaign resumed');
}

export async function updateMetaCampaignBudget(
  campaignId: string,
  accessToken: string,
  dailyBudgetPaisa: number
): Promise<void> {
  await metaRequest(
    campaignId,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ daily_budget: String(dailyBudgetPaisa) }),
    }
  );
  logger.info({ campaignId, dailyBudgetPaisa }, 'Meta campaign budget updated');
}

// ---------------------------------------------------------------------------
// Insights (metrics)
// ---------------------------------------------------------------------------

export async function getMetaCampaignInsights(
  adAccountId: string,
  accessToken: string,
  campaignId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<MetaAdsCampaignInsight[]> {
  type Response = { data: MetaAdsCampaignInsight[] };

  const data = await metaRequest<Response>(
    `${adAccountId}/insights`,
    accessToken,
    {},
    {
      fields: 'campaign_id,campaign_name,impressions,clicks,spend,actions,action_values,ctr,cpc,frequency,reach',
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      level: 'campaign',
      filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: [campaignId] }]),
      time_increment: '1', // day-by-day breakdowns
      limit: '500',
    }
  );

  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Lead Ads — retrieve lead form submissions
// ---------------------------------------------------------------------------

export async function getMetaLeadFormEntries(
  adFormId: string,
  accessToken: string,
  since?: Date
): Promise<MetaLeadFormEntry[]> {
  type Response = { data: MetaLeadFormEntry[]; paging?: { next?: string } };

  const params: Record<string, string> = {
    fields: 'id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,created_time,field_data,is_organic',
    limit: '500',
  };

  if (since) {
    params['filtering'] = JSON.stringify([
      { field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(since.getTime() / 1000) },
    ]);
  }

  const leads: MetaLeadFormEntry[] = [];
  let nextUrl: string | undefined;

  const first = await metaRequest<Response>(`${adFormId}/leads`, accessToken, {}, params);
  leads.push(...first.data);
  nextUrl = first.paging?.next;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;
    const page = await res.json() as Response;
    leads.push(...page.data);
    nextUrl = page.paging?.next;
  }

  return leads;
}

// ---------------------------------------------------------------------------
// Conversions API (CAPI) — send server-side events for IOS 14+ accuracy
// ---------------------------------------------------------------------------

export async function sendMetaCAPIEvents(
  pixelId: string,
  accessToken: string,
  events: MetaCAPIEvent[]
): Promise<{ events_received: number; fbtrace_id: string }> {
  type Response = { events_received: number; fbtrace_id: string };

  const result = await metaRequest<Response>(
    `${pixelId}/events`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        data: events,
        // test_event_code: process.env.META_CAPI_TEST_CODE, // uncomment for testing
      }),
    }
  );

  logger.info({ eventsReceived: result.events_received, pixelId }, 'Meta CAPI events sent');
  return result;
}

// ---------------------------------------------------------------------------
// HMAC signature verification for webhooks
// ---------------------------------------------------------------------------

import { createHmac } from 'crypto';

export function verifyMetaWebhookSignature(
  payload: string,
  signature: string, // "sha256=abc123..."
  appSecret: string
): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  const received = signature.slice('sha256='.length);

  // Constant-time comparison
  if (expected.length !== received.length) return false;
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(received, 'hex');
  return expectedBuf.equals(receivedBuf);
}

// ---------------------------------------------------------------------------
// SHA-256 hashing for CAPI user data
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';

export function hashForCAPI(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

// ---------------------------------------------------------------------------
// Credential builder from env
// ---------------------------------------------------------------------------

export interface MetaAdsCredentials {
  adAccountId: string;
  accessToken: string;
  appSecret: string;
  pixelId: string;
}

export function getMetaAdsCreds(): MetaAdsCredentials | null {
  const {
    META_AD_ACCOUNT_ID,
    META_ACCESS_TOKEN,
    META_APP_SECRET,
    META_PIXEL_ID,
  } = process.env;

  if (!META_AD_ACCOUNT_ID || !META_ACCESS_TOKEN || !META_APP_SECRET || !META_PIXEL_ID) {
    return null;
  }

  return {
    adAccountId: META_AD_ACCOUNT_ID,
    accessToken: META_ACCESS_TOKEN,
    appSecret: META_APP_SECRET,
    pixelId: META_PIXEL_ID,
  };
}
