// ===== CREATIVE STATUS & TYPES =====

export type CreativeStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'DEPLOYED';
export type CreativeFormat = 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'RSA' | 'RESPONSIVE_DISPLAY';
export type GenerativeModel =
  | 'GOOGLE_VEO3'
  | 'OPENAI_SORA2'
  | 'RUNWAY_GEN3'
  | 'KLING_AI'
  | 'LUMA_DREAM'
  | 'ADOBE_FIREFLY'
  | 'PIKA_LABS';

// ===== CREATIVE =====

export interface Creative {
  id: string;
  adSetId: string;
  headline: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  format: CreativeFormat;
  generativeModel?: GenerativeModel;
  generativePrompt?: string;
  complianceScore?: number;   // 0.0–1.0; threshold 0.85 for auto-deploy
  status: CreativeStatus;
  platform: 'GOOGLE' | 'META';
  externalId?: string;        // Platform ad ID after deployment
  createdAt: Date;
}

// ===== GENERATIVE PROMPT BUNDLE (output of Generative Abstraction Layer) =====

export interface GenerativePromptBundle {
  campaignId: string;
  brief: {
    product: string;
    audience: string;
    tone: string;
    durationSec: number;
    callToAction: string;
  };
  prompts: {
    [K in GenerativeModel]?: {
      prompt: string;
      estimatedCostUSD: number;
      syntaxVersion: string;    // e.g., "veo3-v1", "sora2-api"
      warnings: string[];       // Syntax constraint warnings
    };
  };
  recommendedModel: GenerativeModel;
  totalEstimatedCostUSD: number;
  generatedAt: Date;
  generatedBy: 'claude-sonnet-4-6';
}

// ===== COMPLIANCE AUDIT =====

export interface ComplianceAuditResult {
  creativeId: string;
  platform: 'GOOGLE' | 'META' | 'BOTH';
  compliant: boolean;
  score: number;              // 0.0–1.0
  violations: string[];       // Policy violation descriptions
  suggestions: string[];      // AI-generated fix recommendations
  policyChunksReferenced: string[]; // pgvector matched policy sections
  version: number;            // Audit version for history
  auditedAt: Date;
  auditedBy: 'ComplianceAuditorAgent@1.0.0';
}

// ===== A2A AGENT CARD (Compliance Auditor) =====

export interface AgentCard {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoint: string;
  protocol: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
