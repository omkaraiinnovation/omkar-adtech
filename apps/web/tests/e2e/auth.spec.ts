/**
 * E2E tests: Authentication & access control
 *
 * These tests verify that:
 * - Unauthenticated users are redirected to /sign-in
 * - The sign-in page renders correctly
 * - The sign-up page renders correctly
 *
 * Note: Full Clerk auth flows require a live Clerk instance.
 * These tests cover the redirect/render layer only.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users from dashboard to sign-in', async ({ page }) => {
    await page.goto('/');
    // Clerk middleware should redirect to /sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('redirects unauthenticated users from /campaigns to sign-in', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('redirects unauthenticated users from /leads to sign-in', async ({ page }) => {
    await page.goto('/leads');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('redirects unauthenticated users from /creatives to sign-in', async ({ page }) => {
    await page.goto('/creatives');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('redirects unauthenticated users from /budgets to sign-in', async ({ page }) => {
    await page.goto('/budgets');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('redirects unauthenticated users from /agents to sign-in', async ({ page }) => {
    await page.goto('/agents');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('sign-in page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-in');
    // Clerk renders an iframe or form for sign-in
    await expect(page.locator('body')).toBeVisible();
    // The page should not show a 404 or error
    const title = await page.title();
    expect(title).not.toContain('404');
  });

  test('sign-up page renders Clerk component', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title).not.toContain('404');
  });
});
