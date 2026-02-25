/**
 * Shared Playwright fixtures for Omkar AdTech E2E tests
 */

import { test as base, Page } from '@playwright/test';

/**
 * Mock all tRPC calls to return empty but valid data shapes.
 * Use this in tests that need to render pages without a live backend.
 */
export async function mockAllTRPC(page: Page): Promise<void> {
  const emptyResponses: Record<string, unknown> = {
    'dashboard.getOverview': {
      kpis: { totalSpendPaisa: 0, totalLeads: 0, avgRoas: 0, avgCplPaisa: 0 },
      recentCampaigns: [],
    },
    'campaigns.getAll': [],
    'campaigns.getMetrics': { daily: [] },
    'leads.getAll': [],
    'leads.getPipelineCounts': { NEW: 0, QUALIFYING: 0, QUALIFIED: 0, ATTENDING: 0, ENROLLED: 0, LOST: 0 },
    'creatives.getAll': [],
    'agents.getLogs': [],
    'agents.getStats': {
      total: 0, successRate: 0, failed: 0, avgMs: 0, agentBreakdown: [],
    },
    'budget.getDashboardSummary': {
      totalSpendPaisa: 0, avgRoas: 0, avgCplPaisa: 0, activeCampaigns: 0,
    },
    'budget.getHeatmapData': [],
    'budget.getReallocationLog': [],
  };

  await page.route('**/api/trpc/**', async (route) => {
    const url = route.request().url();
    const procedure = Object.keys(emptyResponses).find((key) => url.includes(key));
    const data = procedure ? emptyResponses[procedure] : null;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { data } }),
    });
  });
}

/**
 * Extended test with pre-wired tRPC mocks.
 * Usage: import { test } from './fixtures';
 */
export const test = base.extend<{ mockedPage: Page }>({
  mockedPage: async ({ page }, use) => {
    await mockAllTRPC(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
