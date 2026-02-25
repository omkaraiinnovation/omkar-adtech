/**
 * LangGraph StateGraph Pipeline — orchestrates all 6 agents
 * Uses parallel execution where possible for efficiency
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { AdTechAgentStateAnnotation } from './state';
import type { AdTechAgentState, CampaignBriefInput } from './state';
import {
  contextEvaluationNode,
  creativeAssemblyNode,
  generativeOutputNode,
  complianceAuditorNode,
  identityResolutionNode,
  performanceMonitorNode,
  persistAgentResults,
} from './nodes';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Build the StateGraph
// ---------------------------------------------------------------------------

function buildAdTechGraph() {
  const graph = new StateGraph(AdTechAgentStateAnnotation);

  // Add nodes
  graph.addNode('context_evaluation', contextEvaluationNode);
  graph.addNode('creative_assembly', creativeAssemblyNode);
  graph.addNode('generative_output', generativeOutputNode);
  graph.addNode('compliance_auditor', complianceAuditorNode);
  graph.addNode('identity_resolution', identityResolutionNode);
  graph.addNode('performance_monitor', performanceMonitorNode);
  graph.addNode('persist_results', persistAgentResults);

  // Define execution flow:
  // 1. context_evaluation (must run first — gathers context)
  // 2. creative_assembly (depends on context)
  // 3. generative_output (depends on assembly)
  // 4. compliance_auditor (depends on variants)
  // 5. identity_resolution + performance_monitor (parallel, independent)
  // 6. persist_results (final node)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edge = (a: string, b: string) => graph.addEdge(a as any, b as any);

  edge(START, 'context_evaluation');

  edge('context_evaluation', 'creative_assembly');
  edge('creative_assembly', 'generative_output');
  edge('generative_output', 'compliance_auditor');

  // After compliance, run identity_resolution and performance_monitor in parallel
  edge('compliance_auditor', 'identity_resolution');
  edge('compliance_auditor', 'performance_monitor');

  // Both parallel nodes feed into persist_results
  edge('identity_resolution', 'persist_results');
  edge('performance_monitor', 'persist_results');

  edge('persist_results', END);

  return graph.compile();
}

// Compile once at module load time
const adTechGraph = buildAdTechGraph();

// ---------------------------------------------------------------------------
// Public API — run the pipeline
// ---------------------------------------------------------------------------

export interface PipelineRunResult {
  success: boolean;
  agentLogId: string | null;
  variantsGenerated: number;
  variantsApproved: number;
  performanceInsights: AdTechAgentState['performanceInsights'];
  errors: string[];
  messages: AdTechAgentState['messages'];
  durationMs: number;
}

export async function runAdTechPipeline(brief: CampaignBriefInput): Promise<PipelineRunResult> {
  const start = Date.now();

  logger.info({ campaignId: brief.campaignId }, 'Starting AdTech agent pipeline');

  try {
    const initialState: Partial<AdTechAgentState> = {
      brief,
      messages: [{
        role: 'user',
        content: `Run creative pipeline for campaign: ${brief.campaignName}`,
        timestamp: Date.now(),
      }],
    };

    const finalState = await adTechGraph.invoke(initialState);

    const durationMs = Date.now() - start;

    logger.info(
      {
        campaignId: brief.campaignId,
        durationMs,
        variantsApproved: finalState.approvedVariants?.length ?? 0,
        errors: finalState.errors?.length ?? 0,
      },
      'AdTech pipeline complete'
    );

    return {
      success: (finalState.errors?.length ?? 0) === 0,
      agentLogId: finalState.agentLogId ?? null,
      variantsGenerated: finalState.creativeVariants?.length ?? 0,
      variantsApproved: finalState.approvedVariants?.length ?? 0,
      performanceInsights: finalState.performanceInsights ?? null,
      errors: finalState.errors ?? [],
      messages: finalState.messages ?? [],
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error({ err, campaignId: brief.campaignId }, 'AdTech pipeline failed');

    return {
      success: false,
      agentLogId: null,
      variantsGenerated: 0,
      variantsApproved: 0,
      performanceInsights: null,
      errors: [String(err)],
      messages: [],
      durationMs,
    };
  }
}
