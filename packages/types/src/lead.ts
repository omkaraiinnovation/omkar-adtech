// ===== LEAD STATUS =====

export type LeadStatus = 'NEW' | 'QUALIFYING' | 'QUALIFIED' | 'ATTENDING' | 'ENROLLED' | 'LOST';
export type LeadSource = 'META' | 'GOOGLE';

// ===== UNIFIED LEAD (from webhook/poller normalization) =====

export interface UnifiedLead {
  phone: string;             // E.164 format, e.g., +919876543210
  name: string;
  email?: string;
  city?: string;
  source: LeadSource;
  campaignId: string;        // Internal platform campaign UUID
  externalCampaignId: string; // Google/Meta campaign ID
  formId: string;            // Lead form ID
  submittedAt: Date;
  rawPayload: unknown;       // Original platform payload for audit trail
}

// ===== LEAD SCORE =====

export interface LeadScore {
  leadId: string;
  score: number;             // 0–100
  reasoning: string;         // Claude AI explanation
  signals: {
    intentKeywords: string[];
    engagementLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    geographicMatch: boolean;
    demographicMatch: boolean;
  };
  calculatedAt: Date;
}

// ===== META LEAD ADS WEBHOOK PAYLOAD =====

export interface MetaLeadAdsWebhookPayload {
  object: 'page';
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      value: {
        ad_id: string;
        ad_name: string;
        adset_id: string;
        adset_name: string;
        campaign_id: string;
        campaign_name: string;
        form_id: string;
        leadgen_id: string;
        created_time: number;
        page_id: string;
      };
      field: 'leadgen';
    }>;
  }>;
}

// ===== META CAPI EVENT =====

export interface MetaCAPIEvent {
  event_name: 'Lead' | 'CompleteRegistration' | 'Purchase';
  event_time: number;        // Unix timestamp
  event_source_url?: string;
  action_source: 'system_generated' | 'website';
  user_data: {
    em: string[];            // SHA256-hashed emails
    ph: string[];            // SHA256-hashed phones
    fn?: string;             // SHA256-hashed first name
    ln?: string;             // SHA256-hashed last name
    ct?: string;             // SHA256-hashed city
    country?: string;        // 2-letter lowercase ISO code, e.g., "in"
    fbc?: string;            // Facebook click ID from _fbc cookie
    fbp?: string;            // Facebook browser ID from _fbp cookie
  };
  custom_data?: {
    currency?: 'INR';
    value?: number;
    lead_event_source?: string;
    event_id?: string;       // Deduplication ID (fbtrace_id)
  };
}
