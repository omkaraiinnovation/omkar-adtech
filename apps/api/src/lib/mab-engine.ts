/**
 * Multi-Armed Bandit (MAB) Budget Engine
 * Algorithm: UCB1 (Upper Confidence Bound 1) with Thompson Sampling cold-start
 * Change detection: CUSUM (Cumulative Sum Control Chart)
 *
 * Budget allocation runs every 15 minutes triggered by the metrics poller.
 * Redis stores arm state: mab:arm:{campaignId}:{adSetId}:{creativeId}
 *
 * References:
 * - UCB1: Auer et al. "Finite-time Analysis of the Multiarmed Bandit Problem" (2002)
 * - CUSUM: Hinkley (1971), adapted for ad performance monitoring
 */

import { redis, mabArmKey } from './redis';
import { prisma } from './prisma';
import { logger } from './logger';
import { getGoogleAdsCreds, updateGoogleAdsCampaignBudget } from './google-ads';
import { getMetaAdsCreds, updateMetaCampaignBudget } from './meta-ads';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MABArm {
  campaignId: string;
  adSetId: string;
  creativeId?: string;
  pulls: number;         // Total times this arm was chosen
  totalReward: number;   // Cumulative ROAS reward
  avgReward: number;     // totalReward / pulls
  ucbScore: number;      // UCB1 score (higher = explore/exploit)
  // Thompson Sampling priors (for cold-start when pulls < 30)
  alpha: number;         // Beta distribution alpha = successes + 1
  beta: number;          // Beta distribution beta = failures + 1
  // CUSUM change detection
  cusumPositive: number; // Positive drift detector
  cusumNegative: number; // Negative drift detector
  lastUpdated: number;   // Unix timestamp
}

export interface AllocationDecision {
  campaignId: string;
  adSetId: string;
  allocatedBudgetPaisa: number;
  ucbScore: number;
  reason: 'UCB1' | 'THOMPSON_SAMPLING' | 'CUSUM_RESET' | 'MINIMUM_SPEND';
}

// ---------------------------------------------------------------------------
// UCB1 score calculation
// UCB1(i) = avgReward(i) + C * sqrt(ln(totalPulls) / pulls(i))
// C = exploration constant (higher = more exploration)
// ---------------------------------------------------------------------------

const EXPLORATION_CONSTANT = 2.0;
const COLD_START_THRESHOLD = 30; // Switch to UCB1 after 30 pulls
const CUSUM_THRESHOLD = 5.0;     // CUSUM threshold for change detection
const CUSUM_DRIFT_DELTA = 0.5;   // Expected drift magnitude

function calculateUCB1(arm: MABArm, totalPulls: number): number {
  if (arm.pulls === 0) return Infinity; // Always explore unvisited arms
  return arm.avgReward + EXPLORATION_CONSTANT * Math.sqrt(Math.log(totalPulls) / arm.pulls);
}

// ---------------------------------------------------------------------------
// Thompson Sampling for cold-start (pulls < COLD_START_THRESHOLD)
// Sample from Beta(alpha, beta) distribution
// ---------------------------------------------------------------------------

function thompsonSample(arm: MABArm): number {
  // Beta distribution via ratio of Gamma samples (Marsaglia method)
  const gammaSample = (k: number): number => {
    if (k < 1) return gammaSample(k + 1) * Math.random() ** (1 / k);
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x: number, v: number;
      do {
        x = gaussianRandom();
        v = (1 + c * x) ** 3;
      } while (v <= 0);
      const u = Math.random();
      if (u < 1 - 0.0331 * (x * x) ** 2) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };

  const g1 = gammaSample(arm.alpha);
  const g2 = gammaSample(arm.beta);
  return g1 / (g1 + g2);
}

function gaussianRandom(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------------
// CUSUM change-point detection
// Detects when arm's performance has significantly changed
// ---------------------------------------------------------------------------

function updateCUSUM(arm: MABArm, newReward: number): { arm: MABArm; changeDetected: boolean } {
  const expectedReward = arm.avgReward;

  // Update CUSUM statistics
  const innovation = newReward - expectedReward - CUSUM_DRIFT_DELTA;
  const newCusumPos = Math.max(0, arm.cusumPositive + innovation);
  const newCusumNeg = Math.max(0, arm.cusumNegative - innovation - CUSUM_DRIFT_DELTA);

  const changeDetected = newCusumPos > CUSUM_THRESHOLD || newCusumNeg > CUSUM_THRESHOLD;

  return {
    arm: {
      ...arm,
      cusumPositive: changeDetected ? 0 : newCusumPos,
      cusumNegative: changeDetected ? 0 : newCusumNeg,
    },
    changeDetected,
  };
}

// ---------------------------------------------------------------------------
// Load / Save arm state from/to Redis
// ---------------------------------------------------------------------------

async function loadArm(campaignId: string, adSetId: string): Promise<MABArm> {
  const key = mabArmKey(campaignId, adSetId, 'combined');
  const data = await redis.get<MABArm>(key);

  if (data) return data;

  // Initialize new arm
  return {
    campaignId,
    adSetId,
    pulls: 0,
    totalReward: 0,
    avgReward: 0,
    ucbScore: Infinity,
    alpha: 1,
    beta: 1,
    cusumPositive: 0,
    cusumNegative: 0,
    lastUpdated: Date.now(),
  };
}

async function saveArm(arm: MABArm): Promise<void> {
  const key = mabArmKey(arm.campaignId, arm.adSetId, 'combined');
  await redis.set(key, arm, { ex: 7 * 24 * 60 * 60 }); // 7-day TTL
}

// ---------------------------------------------------------------------------
// Update arm after observing reward (ROAS from metrics)
// ---------------------------------------------------------------------------

export async function updateArmReward(
  campaignId: string,
  adSetId: string,
  roasReward: number
): Promise<void> {
  const arm = await loadArm(campaignId, adSetId);

  // CUSUM check
  const { arm: armAfterCusum, changeDetected } = updateCUSUM(arm, roasReward);
  if (changeDetected) {
    logger.info({ campaignId, adSetId }, 'CUSUM change-point detected — resetting arm state');
    await prisma.agentLog.create({
      data: {
        agentName: 'MABEngine',
        action: 'cusum_change_detected',
        inputJson: { campaignId, adSetId, roasReward } as object,
        outputJson: { previousAvg: arm.avgReward, newReward: roasReward } as object,
        status: 'SUCCESS',
        ms: 0,
      },
    });
  }

  const newPulls = armAfterCusum.pulls + 1;
  const newTotal = armAfterCusum.totalReward + roasReward;
  const newAvg = newTotal / newPulls;

  // Thompson Sampling: success = ROAS > 2 (2x return), failure = ROAS < 2
  const isSuccess = roasReward >= 2.0;
  const updatedArm: MABArm = {
    ...armAfterCusum,
    pulls: newPulls,
    totalReward: newTotal,
    avgReward: newAvg,
    alpha: armAfterCusum.alpha + (isSuccess ? 1 : 0),
    beta: armAfterCusum.beta + (isSuccess ? 0 : 1),
    lastUpdated: Date.now(),
  };

  await saveArm(updatedArm);
}

// ---------------------------------------------------------------------------
// Run UCB1 allocation for a user's campaigns
// Returns allocation decisions (call platform APIs separately)
// ---------------------------------------------------------------------------

export async function runMABAllocation(
  userId: string,
  totalDailyBudgetPaisa: number
): Promise<AllocationDecision[]> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: { adSets: { select: { id: true } } },
  });

  if (campaigns.length === 0) return [];

  // Build arm list for all active ad sets
  const arms: MABArm[] = [];
  for (const campaign of campaigns) {
    for (const adSet of campaign.adSets) {
      const arm = await loadArm(campaign.id, adSet.id);
      arms.push(arm);
    }
  }

  if (arms.length === 0) return [];

  const totalPulls = arms.reduce((s, a) => s + a.pulls, 0);

  // Calculate scores for each arm
  const scoredArms = arms.map((arm) => {
    let score: number;
    let reason: AllocationDecision['reason'];

    if (arm.pulls < COLD_START_THRESHOLD) {
      // Cold-start: use Thompson Sampling
      score = thompsonSample(arm);
      reason = 'THOMPSON_SAMPLING';
    } else {
      // Warm: use UCB1
      score = calculateUCB1(arm, totalPulls);
      reason = 'UCB1';
    }

    return { arm, score, reason };
  });

  // Normalize scores to allocate budget proportionally
  const totalScore = scoredArms.reduce((s, a) => s + (isFinite(a.score) ? a.score : 2), 0);
  const MIN_BUDGET_PAISA = 10000 * 100; // ₹10,000 minimum per arm

  const decisions: AllocationDecision[] = scoredArms.map(({ arm, score, reason }) => {
    const normalizedScore = isFinite(score) ? score : 2;
    const proportion = normalizedScore / totalScore;
    const rawBudget = Math.round(totalDailyBudgetPaisa * proportion);
    const allocatedBudget = Math.max(rawBudget, MIN_BUDGET_PAISA);

    return {
      campaignId: arm.campaignId,
      adSetId: arm.adSetId,
      allocatedBudgetPaisa: allocatedBudget,
      ucbScore: score,
      reason,
    };
  });

  // Log allocation
  logger.info(
    { userId, totalBudget: totalDailyBudgetPaisa, arms: decisions.length },
    'MAB allocation complete'
  );

  // Update UCB scores in Redis and DB
  for (const decision of decisions) {
    const arm = arms.find((a) => a.campaignId === decision.campaignId && a.adSetId === decision.adSetId);
    if (arm) {
      arm.ucbScore = decision.ucbScore;
      await saveArm(arm);

      // Update BudgetAllocation with UCB score for heatmap visualization
      await prisma.budgetAllocation.upsert({
        where: {
          campaignId_date: {
            campaignId: decision.campaignId,
            date: new Date(new Date().toISOString().slice(0, 10)),
          },
        },
        create: {
          campaignId: decision.campaignId,
          date: new Date(new Date().toISOString().slice(0, 10)),
          allocated: decision.allocatedBudgetPaisa,
          ucbScore: isFinite(decision.ucbScore) ? decision.ucbScore : 99,
          reallocationReason: `MAB(${decision.reason})`,
          triggerType: 'UCB_SCHEDULED',
        },
        update: {
          allocated: decision.allocatedBudgetPaisa,
          ucbScore: isFinite(decision.ucbScore) ? decision.ucbScore : 99,
          reallocationReason: `MAB(${decision.reason})`,
          triggerType: 'UCB_SCHEDULED',
        },
      });
    }
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// Apply allocation decisions to platform APIs
// ---------------------------------------------------------------------------

export async function applyBudgetAllocations(
  decisions: AllocationDecision[]
): Promise<void> {
  const googleCreds = getGoogleAdsCreds();
  const metaCreds = getMetaAdsCreds();

  for (const decision of decisions) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: decision.campaignId },
        select: { platform: true, externalId: true, targeting: true },
      });

      if (!campaign?.externalId) continue;

      if (campaign.platform === 'GOOGLE' && googleCreds) {
        const targeting = campaign.targeting as Record<string, unknown> | null;
        const budgetResourceName = targeting?.budgetResourceName as string | undefined;
        if (budgetResourceName) {
          await updateGoogleAdsCampaignBudget(
            googleCreds,
            budgetResourceName,
            decision.allocatedBudgetPaisa * 10_000 // paisa → micros
          );
        }
      } else if (campaign.platform === 'META' && metaCreds) {
        await updateMetaCampaignBudget(
          campaign.externalId,
          metaCreds.accessToken,
          decision.allocatedBudgetPaisa
        );
      }

      logger.info(
        { campaignId: decision.campaignId, budget: decision.allocatedBudgetPaisa, reason: decision.reason },
        'Budget allocation applied'
      );
    } catch (err) {
      logger.error({ err, campaignId: decision.campaignId }, 'Failed to apply budget allocation');
    }
  }
}

// ---------------------------------------------------------------------------
// Export for use in cron / tRPC
// ---------------------------------------------------------------------------

export async function runFullMABCycle(userId: string, totalBudgetPaisa: number): Promise<{
  decisions: AllocationDecision[];
  applied: boolean;
}> {
  const decisions = await runMABAllocation(userId, totalBudgetPaisa);
  if (decisions.length > 0) {
    await applyBudgetAllocations(decisions);
  }
  return { decisions, applied: true };
}
