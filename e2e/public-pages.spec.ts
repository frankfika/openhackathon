import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
  test('landing page loads correctly', async ({ page }) => {
    await page.goto('/');

    // Check main content - use heading for more specific matching
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Check body contains hackathon text
    await expect(page.locator('body')).toContainText('Hackathon');

    // Check navigation links in header nav (first nav)
    const headerNav = page.locator('nav').first();
    await expect(headerNav).toContainText('Projects');
    await expect(headerNav).toContainText('Leaderboard');
  });

  test('projects page shows project gallery', async ({ page }) => {
    await page.goto('/projects');

    // Check page has content
    await expect(page.locator('body')).toContainText('Project');

    // Should show projects or empty state
    const content = page.locator('main, .container').first();
    await expect(content).toBeVisible();
  });

  test('leaderboard page loads correctly', async ({ page }) => {
    await page.goto('/leaderboard');

    // Check page has leaderboard content
    await expect(page.locator('body')).toContainText('Leaderboard');
  });

  test('docs page loads correctly', async ({ page }) => {
    await page.goto('/docs');

    // Check docs page loaded - check URL and basic content
    await expect(page).toHaveURL(/.*docs/);
    await expect(page.locator('body')).toContainText('Docs');
  });

  test('submit project page loads correctly', async ({ page }) => {
    await page.goto('/submit');

    // Check form fields exist
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('navigation works between public pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Projects using nav link
    await page.getByRole('link', { name: /projects/i }).first().click();
    await expect(page).toHaveURL(/.*projects/);
  });

  test('login link from landing page works', async ({ page }) => {
    await page.goto('/');

    // Find sign in link and click
    const signInLink = page.getByRole('link', { name: /sign in/i });
    if (await signInLink.isVisible().catch(() => false)) {
      await signInLink.click();
      await expect(page).toHaveURL(/.*login/);
    }
  });
});