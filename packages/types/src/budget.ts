// ===== MAB ARM STATE (stored in Redis) =====

export interface MABArm {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  pulls: number;             // Total number of times this arm was selected
  totalReward: number;       // Sum of all reward values
  meanReward: number;        // totalReward / pulls
  ucbScore: number;          // UCB1 exploration bonus score
  lastUpdated: Date;
  cusum: {
    gPos: number;            // CUSUM positive statistic (Gi_pos)
    gNeg: number;            // CUSUM negative statistic (Gi_neg)
    mu0: number;             // Baseline mean reward
    changePointDetected: boolean;
  };
}

// Redis key: mab:arm:{campaignId}:{adSetId}:{creativeId}

// ===== BUDGET ALLOCATION RECORD =====

export interface BudgetAllocationRecord {
  id: string;
  campaignId: string;
  date: Date;
  amount: number;            // INR paisa allocated
  roas: number;              // Return on ad spend
  impressions: number;
  clicks: number;
  conversions: number;
  ucbScore: number;
  reallocationReason?: string; // Why MAB shifted budget
  previousAmount?: number;   // INR paisa (for audit trail)
  createdAt: Date;
}

// ===== REALLOCATION DECISION =====

export interface ReallocationDecision {
  timestamp: Date;
  campaigns: Array<{
    campaignId: string;
    adSetId: string;
    creativeId: string;
    previousBudget: number;  // INR paisa
    newBudget: number;       // INR paisa
    ucbScore: number;
    reasoning: string;
  }>;
  totalBudget: number;       // INR paisa (must remain constant)
  triggerType: 'UCB_SCHEDULED' | 'CUSUM_CHANGE_POINT' | 'ANOMALY_DETECTED' | 'MANUAL';
  triggerAgentName?: string;
}

// ===== KAFKA EVENTS =====

export interface AdMetricsPollEvent {
  campaignId: string;
  platform: 'GOOGLE' | 'META';
  metrics: import('./campaign').CampaignMetrics;
  polledAt: Date;
}

export interface LeadCapturedEvent {
  leadId: string;
  campaignId: string;
  phone: string;
  source: 'META' | 'GOOGLE';
  capturedAt: Date;
}

export interface ConversionEvent {
  leadId: string;
  campaignId: string;
  adSetId?: string;
  creativeId?: string;
  conversionType: 'LEAD' | 'REGISTRATION' | 'ENROLLMENT';
  value: number;             // INR paisa
  conversionAt: Date;
  source: 'META_CAPI' | 'GOOGLE_CONVERSION' | 'CRM';
}

export interface AnomalyDetectedEvent {
  campaignId: string;
  metric: keyof import('./campaign').CampaignMetrics;
  expectedValue: number;
  actualValue: number;
  deviationPct: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedAt: Date;
  agentName: 'PerformanceMonitorAgent';
}
