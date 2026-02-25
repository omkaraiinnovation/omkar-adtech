// ===== PLATFORM & STATUS ENUMS =====

export type Platform = 'GOOGLE' | 'META';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type Objective = 'LEAD_GEN' | 'CONVERSIONS' | 'AWARENESS' | 'TRAFFIC';
export type Gender = 'MALE' | 'FEMALE' | 'ALL';

// ===== TARGETING =====

export interface CampaignTargeting {
  locations: string[];      // ISO region codes: ['IN-MH', 'IN-KA', 'IN-DL', 'IN-TN', 'IN-TS', 'IN-RJ', 'IN-UP', 'IN-GJ']
  ageMin: number;           // 18–65
  ageMax: number;
  genders: Gender[];
  interests: string[];      // Meta interest IDs or Google audience IDs
  devices?: ('MOBILE' | 'DESKTOP' | 'TABLET')[];
}

// ===== METRICS =====

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  ctr: number;              // Click-through rate (0.00–1.00)
  conversions: number;
  cpa: number;              // Cost per acquisition in INR paisa
  roas: number;             // Return on ad spend (e.g., 3.5 = 3.5x)
  spend: number;            // Total spend in INR paisa
  leads: number;
  cpl: number;              // Cost per lead in INR paisa
  revenue?: number;         // Attributed revenue in INR paisa
}

// ===== UNIFIED CAMPAIGN =====

export interface UnifiedCampaign {
  id: string;               // Internal platform UUID (cuid)
  externalId: string;       // Google Campaign ID or Meta Campaign ID
  platform: Platform;
  name: string;
  status: CampaignStatus;
  objective: Objective;
  dailyBudget: number;      // INR paisa (1 rupee = 100 paisa)
  lifetimeBudget?: number;  // INR paisa
  startDate?: Date;
  endDate?: Date;
  targeting: CampaignTargeting;
  metrics: CampaignMetrics;
  lastSyncedAt: Date;
  provisional: boolean;     // true if data is < 24h old (not fully attributed)
  userId: string;
  createdAt: Date;
}

// ===== AD SET =====

export interface UnifiedAdSet {
  id: string;
  externalId: string;
  campaignId: string;
  name: string;
  targeting: CampaignTargeting;
  bidStrategy: string;
  budget: number;           // INR paisa
  status: CampaignStatus;
  metrics: CampaignMetrics;
}

// ===== CAMPAIGN BRIEF (for AI Agents) =====

export interface CampaignBrief {
  campaignId: string;
  product: string;          // e.g., "AI Unlock All Live Workshop"
  audience: string;         // e.g., "Professionals 25-45, India, AI-curious"
  tone: 'URGENT' | 'INSPIRATIONAL' | 'EDUCATIONAL' | 'PREMIUM' | 'CONVERSATIONAL';
  durationSec: number;      // For video ads (8–60 seconds)
  platforms: Platform[];
  objective: Objective;
  keyMessages: string[];    // Top 3 selling points
  brandColors: string[];    // Hex codes
  callToAction: string;     // e.g., "Register Now", "Claim Your Spot"
  budget: number;           // INR paisa
  workshopDate?: string;    // ISO date string
  workshopCity?: string;
}

// ===== FORECAST =====

export interface CampaignForecast {
  campaignId: string;
  scenario: 'CONSERVATIVE' | 'BASE' | 'AGGRESSIVE';
  estimatedImpressions: { min: number; max: number };
  estimatedClicks: { min: number; max: number };
  estimatedCtr: number;
  estimatedConversions: { min: number; max: number };
  estimatedCpa: { min: number; max: number };  // INR paisa
  estimatedBudget: number; // INR paisa
  generatedAt: Date;
  source: 'GOOGLE_FORECAST' | 'INTERNAL_MODEL';
}
