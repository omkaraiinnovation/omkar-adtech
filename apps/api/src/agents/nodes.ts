/**
 * LangGraph Agent Nodes — 6 specialized agents
 *
 * 1. ContextEvaluationNode    — Gathers platform best practices, audience context
 * 2. CreativeAssemblyNode     — Builds creative briefs and structured prompts
 * 3. GenerativeOutputNode     — Generates copy variants using Claude
 * 4. ComplianceAuditorNode    — Checks each variant against policy rules
 * 5. IdentityResolutionNode   — Deduplicates leads across platforms
 * 6. PerformanceMonitorNode   — Analyzes metrics and detects anomalies
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import type { AdTechAgentState, CreativeVariant, ComplianceResult } from './state';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Helper: call Claude with structured output
// ---------------------------------------------------------------------------

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2048): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = msg.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected Claude response type');
  return content.text;
}

// ---------------------------------------------------------------------------
// 1. ContextEvaluationNode
// Gathers platform best practices and competitive context
// ---------------------------------------------------------------------------

export async function contextEvaluationNode(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief } = state;
  if (!brief) return { errors: ['No campaign brief provided'] };

  logger.info({ campaignId: brief.campaignId }, '[ContextEvaluation] Starting');

  const platformGuide = brief.platform === 'GOOGLE'
    ? `Google Ads best practices: Use RSA with 15 headlines, 4 descriptions. Keywords in headline 1. Extensions enabled. Target CPA bidding for lead gen.`
    : `Meta Ads best practices: Lead forms with instant forms reduce friction. Use lookalike audiences. Video gets 3x more engagement. Keep copy under 125 chars.`;

  const audienceText = await callClaude(
    'You are an expert in Indian digital marketing and AI education. Provide brief, actionable audience insights.',
    `Analyze the target audience for this campaign:
Product: ${brief.product}
Target: ${brief.targetAudience}
Platform: ${brief.platform}
Objective: ${brief.objective}

Provide 3-5 key audience insights and pain points in JSON: {"insights": ["..."], "painPoints": ["..."], "motivators": ["..."]}`
  );

  return {
    audienceContext: audienceText,
    platformBestPractices: platformGuide,
    currentAgent: 'ContextEvaluation',
    messages: [{
      role: 'assistant' as const,
      content: `[ContextEvaluation] Gathered audience context and platform best practices for ${brief.platform}`,
      agentName: 'ContextEvaluationAgent',
      timestamp: Date.now(),
    }],
  };
}

// ---------------------------------------------------------------------------
// 2. CreativeAssemblyNode
// Builds structured creative briefs from the context gathered
// ---------------------------------------------------------------------------

export async function creativeAssemblyNode(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief, audienceContext, platformBestPractices } = state;
  if (!brief) return { errors: ['No brief in state'] };

  logger.info({ campaignId: brief.campaignId }, '[CreativeAssembly] Starting');

  const assemblyPrompt = `You are a world-class ad creative strategist for Omkar AI Innovation.
Platform best practices: ${platformBestPractices}
Audience insights: ${audienceContext}

Campaign Brief:
- Product: ${brief.product}
- USP: ${brief.usp}
- CTA: ${brief.cta}
- Brand Voice: ${brief.brandVoice}
- Platform: ${brief.platform}

Create 3 distinct creative angles (different emotional/rational approaches):
Return JSON array: [{"angle": "...", "emotionalHook": "...", "rationale": "..."}]`;

  const anglesText = await callClaude(
    'You are a senior creative director specializing in AI education marketing in India.',
    assemblyPrompt,
    1024
  );

  return {
    competitorInsights: anglesText, // Reusing field for creative angles
    currentAgent: 'CreativeAssembly',
    messages: [{
      role: 'assistant' as const,
      content: `[CreativeAssembly] Generated 3 creative angles for ${brief.platform}`,
      agentName: 'CreativeAssemblyAgent',
      timestamp: Date.now(),
    }],
  };
}

// ---------------------------------------------------------------------------
// 3. GenerativeOutputNode
// Generates actual ad copy variants based on assembled briefs
// ---------------------------------------------------------------------------

export async function generativeOutputNode(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief, competitorInsights, audienceContext } = state;
  if (!brief) return { errors: ['No brief in state'] };

  logger.info({ campaignId: brief.campaignId }, '[GenerativeOutput] Starting');

  const isGoogle = brief.platform === 'GOOGLE';

  const copyPrompt = `Generate 3 ad copy variants for this campaign.

Creative angles: ${competitorInsights}
Audience: ${audienceContext}
Product: ${brief.product}
USP: ${brief.usp}
CTA: ${brief.cta}

${isGoogle
  ? 'Format: headline max 30 chars, description max 90 chars. Strong keyword-rich headlines.'
  : 'Format: headline max 40 chars, description max 125 chars. Conversational, benefit-focused.'}

Return JSON array with exactly 3 variants:
[{
  "headline": "...",
  "description": "...",
  "imagePrompt": "Professional Indian professionals in a tech training environment, modern office, aspirational lighting",
  "format": "${isGoogle ? 'RSA' : 'IMAGE'}"
}]`;

  const variantsText = await callClaude(
    'You are an expert ad copywriter specializing in Indian EdTech and AI training programs.',
    copyPrompt,
    1500
  );

  // Parse variants
  let variants: CreativeVariant[] = [];
  try {
    const jsonMatch = variantsText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        headline: string;
        description: string;
        imagePrompt?: string;
        format?: string;
      }>;
      variants = parsed.map((v) => ({
        headline: v.headline ?? '',
        description: v.description ?? '',
        ...(v.imagePrompt && { imagePrompt: v.imagePrompt }),
        platform: brief.platform,
        format: (v.format ?? (isGoogle ? 'RSA' : 'IMAGE')) as CreativeVariant['format'],
        generativeModel: 'claude-sonnet-4-6',
      }));
    }
  } catch (err) {
    logger.error({ err }, '[GenerativeOutput] Failed to parse variants JSON');
  }

  if (variants.length === 0) {
    // Fallback: create one basic variant
    variants = [{
      headline: `Master AI in 3 Days — ${brief.cta}`,
      description: brief.usp,
      platform: brief.platform,
      format: isGoogle ? 'RSA' : 'IMAGE',
      generativeModel: 'claude-sonnet-4-6',
    }];
  }

  return {
    creativeVariants: variants,
    currentAgent: 'GenerativeOutput',
    messages: [{
      role: 'assistant' as const,
      content: `[GenerativeOutput] Generated ${variants.length} creative variants`,
      agentName: 'GenerativeOutputAgent',
      timestamp: Date.now(),
    }],
  };
}

// ---------------------------------------------------------------------------
// 4. ComplianceAuditorNode
// Checks each variant against Meta/Google advertising policies
// ---------------------------------------------------------------------------

export async function complianceAuditorNode(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief, creativeVariants } = state;
  if (!brief || creativeVariants.length === 0) {
    return { errors: ['No variants to audit'] };
  }

  logger.info({ campaignId: brief.campaignId, count: creativeVariants.length }, '[ComplianceAuditor] Starting');

  const results: ComplianceResult[] = [];

  for (let i = 0; i < creativeVariants.length; i++) {
    const variant = creativeVariants[i];
    if (!variant) continue;

    const auditPrompt = `You are an advertising compliance expert for ${brief.platform === 'META' ? 'Meta' : 'Google'} ads.

Review this ad creative against advertising policies:
Headline: "${variant.headline}"
Description: "${variant.description}"
Platform: ${brief.platform}
Product Category: AI Training / Education

Check for:
- Misleading claims or false promises
- Income/earnings guarantees
- Prohibited content for education ads
- Superlatives requiring substantiation
- Platform-specific policy violations

Return JSON:
{
  "compliant": boolean,
  "score": number (0-1),
  "violations": ["..."],
  "suggestions": ["..."]
}`;

    try {
      const auditText = await callClaude(
        'You are a certified advertising compliance auditor. Be strict but fair. Return only valid JSON.',
        auditPrompt,
        512
      );

      const jsonMatch = auditText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          compliant: boolean;
          score: number;
          violations: string[];
          suggestions: string[];
        };
        results.push({
          variantIndex: i,
          compliant: parsed.compliant,
          score: parsed.score,
          violations: parsed.violations ?? [],
          suggestions: parsed.suggestions ?? [],
          approvedForDeployment: parsed.score >= 0.85,
        });
      }
    } catch (err) {
      logger.error({ err, variantIndex: i }, '[ComplianceAuditor] Audit failed for variant');
      results.push({
        variantIndex: i,
        compliant: false,
        score: 0,
        violations: ['Compliance check failed — manual review required'],
        suggestions: [],
        approvedForDeployment: false,
      });
    }
  }

  const approved = creativeVariants.filter((_v, i) => results[i]?.approvedForDeployment);

  return {
    complianceResults: results,
    approvedVariants: approved,
    currentAgent: 'ComplianceAuditor',
    messages: [{
      role: 'assistant' as const,
      content: `[ComplianceAuditor] ${approved.length}/${creativeVariants.length} variants approved (score ≥ 0.85)`,
      agentName: 'ComplianceAuditorAgent',
      timestamp: Date.now(),
    }],
  };
}

// ---------------------------------------------------------------------------
// 5. IdentityResolutionNode
// Deduplicates leads and resolves cross-platform identity
// ---------------------------------------------------------------------------

export async function identityResolutionNode(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief } = state;
  if (!brief) return {};

  logger.info({ campaignId: brief.campaignId }, '[IdentityResolution] Starting');

  try {
    // Find leads with matching phone numbers (dedup across campaigns)
    const recentLeads = await prisma.lead.findMany({
      where: {
        campaignId: brief.campaignId,
        status: { in: ['NEW', 'QUALIFYING'] },
      },
      select: { id: true, phone: true, email: true },
      take: 100,
    });

    // Group by phone to find duplicates
    const phoneGroups = new Map<string, string[]>();
    for (const lead of recentLeads) {
      const existing = phoneGroups.get(lead.phone) ?? [];
      existing.push(lead.id);
      phoneGroups.set(lead.phone, existing);
    }

    // Identify duplicate lead IDs (keep first, flag rest)
    const duplicateIds: string[] = [];
    for (const [, ids] of phoneGroups) {
      if (ids.length > 1) {
        // Keep first occurrence, mark rest as duplicates
        duplicateIds.push(...ids.slice(1));
      }
    }

    // Mark duplicates as LOST with reason
    if (duplicateIds.length > 0) {
      await prisma.lead.updateMany({
        where: { id: { in: duplicateIds } },
        data: { status: 'LOST', metadata: { duplicateResolved: true } as object },
      });

      logger.info({ duplicateCount: duplicateIds.length }, '[IdentityResolution] Resolved duplicates');
    }

    return {
      resolvedLeadIds: recentLeads.map((l: { id: string }) => l.id),
      currentAgent: 'IdentityResolution',
      messages: [{
        role: 'assistant' as const,
        content: `[IdentityResolution] Processed ${recentLeads.length} leads, resolved ${duplicateIds.length} duplicates`,
        agentName: 'IdentityResolutionAgent',
        timestamp: Date.now(),
      }],
    };
  } catch (err) {
    logger.error({ err }, '[IdentityResolution] Failed');
    return { errors: [`IdentityResolution failed: ${String(err)}`] };
  }
}

// ---------------------------------------------------------------------------
// 6. PerformanceMonitorNode
// Analyzes recent metrics, detects anomalies, generates recommendations
// ---------------------------------------------------------------------------

export async function performanceMonitorNode(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief } = state;
  if (!brief) return {};

  logger.info({ campaignId: brief.campaignId }, '[PerformanceMonitor] Starting');

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const allocations = await prisma.budgetAllocation.findMany({
      where: { campaignId: brief.campaignId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    if (allocations.length === 0) {
      return {
        performanceInsights: {
          avgRoas: 0,
          ctr: 0,
          cpl: 0,
          trend: 'STABLE',
          anomalies: [],
          recommendations: ['No performance data yet — campaign may be new'],
        },
        currentAgent: 'PerformanceMonitor',
        messages: [{
          role: 'assistant' as const,
          content: '[PerformanceMonitor] No data available yet',
          agentName: 'PerformanceMonitorAgent',
          timestamp: Date.now(),
        }],
      };
    }

    type Alloc = { roas: number; spend: number; clicks: number; impressions: number; conversions: number };
    const avgRoas = (allocations as Alloc[]).reduce((s: number, a: Alloc) => s + a.roas, 0) / allocations.length;
    const totalSpend = (allocations as Alloc[]).reduce((s: number, a: Alloc) => s + a.spend, 0);
    const totalClicks = (allocations as Alloc[]).reduce((s: number, a: Alloc) => s + a.clicks, 0);
    const totalImpressions = (allocations as Alloc[]).reduce((s: number, a: Alloc) => s + a.impressions, 0);
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // Get lead count for CPL calculation
    const leadCount = await prisma.lead.count({
      where: { campaignId: brief.campaignId, createdAt: { gte: since } },
    });
    const cpl = leadCount > 0 ? totalSpend / leadCount : 0;

    // Simple trend: compare last 3 days vs first 4 days ROAS
    const firstHalf = (allocations as Alloc[]).slice(0, Math.floor(allocations.length / 2));
    const secondHalf = (allocations as Alloc[]).slice(Math.floor(allocations.length / 2));
    const firstAvgRoas = firstHalf.length ? firstHalf.reduce((s: number, a: Alloc) => s + a.roas, 0) / firstHalf.length : 0;
    const secondAvgRoas = secondHalf.length ? secondHalf.reduce((s: number, a: Alloc) => s + a.roas, 0) / secondHalf.length : 0;
    const trend: 'UP' | 'DOWN' | 'STABLE' =
      secondAvgRoas > firstAvgRoas * 1.1 ? 'UP' :
      secondAvgRoas < firstAvgRoas * 0.9 ? 'DOWN' : 'STABLE';

    // Detect anomalies: daily spend > 2x avg
    const avgDailySpend = totalSpend / allocations.length;
    const anomalies: string[] = [];
    for (const a of allocations) {
      if (a.spend > avgDailySpend * 2) {
        anomalies.push(`Spend spike on ${a.date.toISOString().slice(0, 10)}: ₹${(a.spend / 100).toFixed(0)} (2x avg)`);
      }
      if (a.roas > 0 && a.roas < 1) {
        anomalies.push(`ROAS below 1.0 on ${a.date.toISOString().slice(0, 10)}: ${a.roas.toFixed(2)}x`);
      }
    }

    const recommendations: string[] = [];
    if (avgRoas < 2) recommendations.push('ROAS below 2x — consider pausing low-performing ad sets');
    if (ctr < 0.01) recommendations.push('CTR below 1% — test new creative variants');
    if (trend === 'DOWN') recommendations.push('Declining ROAS trend — review targeting and creatives');
    if (anomalies.length > 0) recommendations.push(`${anomalies.length} anomaly/anomalies detected — check MAB engine`);

    return {
      performanceInsights: { avgRoas, ctr, cpl, trend, anomalies, recommendations },
      currentAgent: 'PerformanceMonitor',
      messages: [{
        role: 'assistant' as const,
        content: `[PerformanceMonitor] ROAS: ${avgRoas.toFixed(2)}x | Trend: ${trend} | Anomalies: ${anomalies.length}`,
        agentName: 'PerformanceMonitorAgent',
        timestamp: Date.now(),
      }],
    };
  } catch (err) {
    logger.error({ err }, '[PerformanceMonitor] Failed');
    return { errors: [`PerformanceMonitor failed: ${String(err)}`] };
  }
}

// ---------------------------------------------------------------------------
// Persist results to AgentLog
// ---------------------------------------------------------------------------

export async function persistAgentResults(
  state: AdTechAgentState
): Promise<Partial<AdTechAgentState>> {
  const { brief, approvedVariants, performanceInsights, errors } = state;
  if (!brief) return { completed: true };

  try {
    // Save approved creatives to DB
    for (const variant of approvedVariants) {
      const adSet = await prisma.adSet.findFirst({
        where: { campaignId: brief.campaignId },
      });

      if (adSet) {
        await prisma.creative.create({
          data: {
            adSetId: adSet.id,
            headline: variant.headline,
            description: variant.description,
            format: variant.format,
            generativeModel: variant.generativeModel,
            status: 'APPROVED',
          },
        });
      }
    }

    // Log the run
    const agentLog = await prisma.agentLog.create({
      data: {
        agentName: 'AdTechPipeline',
        action: 'run_creative_pipeline',
        inputJson: { brief } as object,
        outputJson: {
          variantsGenerated: state.creativeVariants.length,
          variantsApproved: approvedVariants.length,
          performanceInsights,
          errors,
        } as object,
        status: errors.length > 0 ? 'FAILED' : 'SUCCESS',
        ms: 0,
      },
    });

    return {
      agentLogId: agentLog.id,
      completed: true,
      messages: [{
        role: 'assistant' as const,
        content: `Pipeline complete. ${approvedVariants.length} creatives saved. Log: ${agentLog.id}`,
        agentName: 'PipelineOrchestrator',
        timestamp: Date.now(),
      }],
    };
  } catch (err) {
    logger.error({ err }, 'Failed to persist agent results');
    return { completed: true, errors: [`Persist failed: ${String(err)}`] };
  }
}
