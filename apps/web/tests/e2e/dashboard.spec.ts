/**
 * E2E tests: Dashboard navigation and page rendering
 *
 * Uses a mock authenticated session via Clerk test helpers.
 * Since Clerk's auth is server-side, we mock the auth response via
 * route interception on the tRPC API endpoint and set a bypass header.
 *
 * For CI: set CLERK_TEST_USER_ID env var to bypass real auth.
 * For local: tests run against the live Clerk dev instance.
 */

import { test, expect, Page } from '@playwright/test';

// Helper: intercept all tRPC calls and return empty data
// so pages render without a live database
async function mockTRPCRoutes(page: Page) {
  await page.route('**/api/trpc/**', async (route) => {
    const url = route.request().url();

    // Return appropriate empty responses for each tRPC procedure
    if (url.includes('dashboard.getOverview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            data: {
              kpis: {
                totalSpendPaisa: 125000000,
                totalLeads: 342,
                avgRoas: 4.2,
                avgCplPaisa: 36500,
              },
            },
          },
        }),
      });
    } else if (url.includes('campaigns.getAll')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: [] } }),
      });
    } else if (url.includes('budget.getDashboardSummary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            data: {
              totalSpendPaisa: 0,
              avgRoas: 0,
              avgCplPaisa: 0,
              activeCampaigns: 0,
            },
          },
        }),
      });
    } else if (url.includes('agents.getStats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            data: {
              total: 0,
              successRate: 0,
              failed: 0,
              avgMs: 0,
              agentBreakdown: [],
            },
          },
        }),
      });
    } else if (url.includes('agents.getLogs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: [] } }),
      });
    } else if (url.includes('creatives.getAll')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: [] } }),
      });
    } else if (url.includes('leads.getAll') || url.includes('leads.getPipelineCounts')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: [] } }),
      });
    } else if (url.includes('budget.getHeatmapData') || url.includes('budget.getReallocationLog')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: [] } }),
      });
    } else {
      // Let other requests pass through or return empty
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { data: null } }),
      });
    }
  });
}

// Skip these tests if no Clerk test bypass is available
// They require a live dev server with auth bypassed
test.describe('Dashboard Navigation', () => {
  test.skip(
    !process.env.CLERK_TEST_USER_ID,
    'Skipped: set CLERK_TEST_USER_ID to run authenticated E2E tests'
  );

  test.beforeEach(async ({ page }) => {
    await mockTRPCRoutes(page);
  });

  test('dashboard home renders KPI cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Command Center');
    // KPI cards should render
    await expect(page.getByText('Total Ad Spend')).toBeVisible();
    await expect(page.getByText('Total Leads')).toBeVisible();
    await expect(page.getByText('Avg ROAS')).toBeVisible();
    await expect(page.getByText('Avg Cost Per Lead')).toBeVisible();
  });

  test('sidebar links are all visible', async ({ page }) => {
    await page.goto('/');
    // Sidebar nav links
    await expect(page.getByRole('link', { name: /campaigns/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /leads/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /creatives/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /budgets/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /agents/i })).toBeVisible();
  });

  test('navigates to /campaigns', async ({ page }) => {
    await page.goto('/');
    await page.click('[href="/campaigns"]');
    await expect(page).toHaveURL('/campaigns');
    await expect(page.locator('h1')).toContainText('Campaigns');
  });

  test('navigates to /leads', async ({ page }) => {
    await page.goto('/');
    await page.click('[href="/leads"]');
    await expect(page).toHaveURL('/leads');
    await expect(page.locator('h1')).toContainText('Lead Pipeline');
  });

  test('navigates to /creatives', async ({ page }) => {
    await page.goto('/');
    await page.click('[href="/creatives"]');
    await expect(page).toHaveURL('/creatives');
    await expect(page.locator('h1')).toContainText('Creative Library');
  });

  test('navigates to /budgets', async ({ page }) => {
    await page.goto('/');
    await page.click('[href="/budgets"]');
    await expect(page).toHaveURL('/budgets');
    await expect(page.locator('h1')).toContainText('Budget Intelligence');
  });

  test('navigates to /agents', async ({ page }) => {
    await page.goto('/');
    await page.click('[href="/agents"]');
    await expect(page).toHaveURL('/agents');
    await expect(page.locator('h1')).toContainText('AI Agents');
  });
});
