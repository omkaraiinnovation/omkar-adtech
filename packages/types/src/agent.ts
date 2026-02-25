// ===== AGENT TYPES =====

export type AgentName =
  | 'CreativeAssemblyAgent'
  | 'ContextEvaluationAgent'
  | 'GenerativeOutputAgent'
  | 'ComplianceAuditorAgent'
  | 'IdentityResolutionAgent'
  | 'PerformanceMonitorAgent';

export type AgentStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

// ===== AGENT LOG ENTRY =====

export interface AgentLogEntry {
  id: string;
  agentName: AgentName;
  action: string;             // e.g., "generate_creative_variants", "audit_compliance"
  inputJson: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  status: AgentStatus;
  ms: number;                 // Execution time in milliseconds
  errorMessage?: string;
  createdAt: Date;
}

// ===== LANGGRAPH STATE =====

export interface AdTechAgentState {
  campaignId: string;
  brief: import('./campaign').CampaignBrief;
  creatives: import('./creative').Creative[];
  selectedCreative: import('./creative').Creative | null;
  complianceScore: number;
  violations: string[];
  roasHistory: number[];      // Last 20 ROAS readings (for CUSUM detection)
  anomalyDetected: boolean;
  currentNode: string;
  iterationCount: number;     // Guard against infinite loops (max: 5)
  errors: string[];
}

// ===== MCP SERVER TOOL SCHEMAS =====

export interface PolicySearchInput {
  query: string;
  platform?: 'GOOGLE' | 'META' | 'BOTH';
  topK?: number;             // Default: 5
}

export interface PolicySearchResult {
  chunks: Array<{
    content: string;
    source: string;           // e.g., "meta-ad-policies-v2024.pdf#section-3"
    similarity: number;       // 0.0–1.0
  }>;
  totalFound: number;
}

export interface AnalyticsMCPInput {
  campaignId: string;
  metrics?: (keyof import('./campaign').CampaignMetrics)[];
  dateRange?: { from: Date; to: Date };
}

export interface CreativeLibrarySearchInput {
  assetType?: 'LOGO' | 'PHOTO' | 'VIDEO_CLIP' | 'ILLUSTRATION';
  tags?: string[];
  platform?: 'GOOGLE' | 'META' | 'BOTH';
  limit?: number;
}

export interface BrandAsset {
  id: string;
  name: string;
  type: 'LOGO' | 'PHOTO' | 'VIDEO_CLIP' | 'ILLUSTRATION';
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  platform: ('GOOGLE' | 'META')[];
  dimensions?: { width: number; height: number };
  durationSec?: number;      // For videos
  fileSizeBytes: number;
  mimeType: string;
  createdAt: Date;
}
