/**
 * E2E tests: Individual page structure and content
 *
 * Tests page-specific UI elements, filter controls, and
 * empty state renderings without requiring live data.
 *
 * Requires CLERK_TEST_USER_ID to bypass Clerk auth middleware.
 */

import { test, expect, Page } from '@playwright/test';

async function stubAllTRPC(page: Page) {
  await page.route('**/api/trpc/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: { data: [] } }),
    })
  );
}

test.describe('Page Structure', () => {
  test.skip(
    !process.env.CLERK_TEST_USER_ID,
    'Skipped: set CLERK_TEST_USER_ID to run authenticated E2E tests'
  );

  test.describe('Campaigns Page (/campaigns)', () => {
    test.beforeEach(async ({ page }) => {
      await stubAllTRPC(page);
      await page.goto('/campaigns');
    });

    test('renders page heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Campaigns');
    });

    test('renders platform filter buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /ALL/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /GOOGLE/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /META/i })).toBeVisible();
    });

    test('renders status filter buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /ACTIVE/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /PAUSED/i })).toBeVisible();
    });

    test('renders New Campaign button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /new campaign/i })).toBeVisible();
    });

    test('shows empty state when no campaigns', async ({ page }) => {
      // With stubbed empty data, should show the empty-state message from CampaignTable
      await expect(page.getByText(/no campaigns/i)).toBeVisible();
    });
  });

  test.describe('Creative Library Page (/creatives)', () => {
    test.beforeEach(async ({ page }) => {
      await stubAllTRPC(page);
      await page.goto('/creatives');
    });

    test('renders page heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Creative Library');
    });

    test('renders status filter buttons', async ({ page }) => {
      const filterLabels = ['ALL', 'DRAFT', 'APPROVED', 'REJECTED', 'DEPLOYED'];
      for (const label of filterLabels) {
        await expect(page.getByRole('button', { name: label })).toBeVisible();
      }
    });

    test('renders Generate Creatives button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /generate creatives/i })).toBeVisible();
    });

    test('shows empty state when no creatives', async ({ page }) => {
      await expect(page.getByText(/no creatives yet/i)).toBeVisible();
    });
  });

  test.describe('Budget Intelligence Page (/budgets)', () => {
    test.beforeEach(async ({ page }) => {
      await stubAllTRPC(page);
      await page.goto('/budgets');
    });

    test('renders page heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Budget Intelligence');
    });

    test('renders Run MAB Allocation button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /run mab allocation/i })).toBeVisible();
    });

    test('renders algorithm info cards', async ({ page }) => {
      await expect(page.getByText('UCB1 Algorithm')).toBeVisible();
      await expect(page.getByText('Thompson Sampling')).toBeVisible();
      await expect(page.getByText('CUSUM Detection')).toBeVisible();
    });

    test('renders How It Works section', async ({ page }) => {
      await expect(page.getByText('How It Works')).toBeVisible();
    });
  });

  test.describe('AI Agents Page (/agents)', () => {
    test.beforeEach(async ({ page }) => {
      await stubAllTRPC(page);
      await page.goto('/agents');
    });

    test('renders page heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('AI Agents');
    });

    test('renders subtitle describing pipeline', async ({ page }) => {
      await expect(page.getByText(/6-agent/i)).toBeVisible();
    });

    test('renders refresh button', async ({ page }) => {
      // Refresh icon button should be present
      await expect(page.locator('button svg').first()).toBeVisible();
    });

    test('shows empty log state when no agent runs', async ({ page }) => {
      await expect(page.getByText(/no agent runs yet/i)).toBeVisible();
    });
  });
});
