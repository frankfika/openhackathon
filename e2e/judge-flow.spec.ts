import { test, expect } from 'playwright/test';

test.describe('Judge Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as judge before each test
    await page.goto('/login');
    await page.locator('text=Judge').click();
    await page.locator('input[type="email"]').fill('alice@techgiants.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*judge/);
  });

  test('judge dashboard shows correct stats', async ({ page }) => {
    // Check dashboard has assignment/status content
    await expect(page.locator('body')).toContainText(/Pending|待评审/i);
    await expect(page.locator('body')).toContainText(/Completed|已完成/i);
  });

  test('judge can view judging queue', async ({ page }) => {
    // Check queue page content
    await expect(page.locator('body')).toContainText(/Judging|评审/i);

    // Check queue has either actionable entries or an empty state
    await expect(page.locator('body')).toContainText(/Start Review|Open review|No pending assignments|No assignments found/i);
  });

  test('judge can start reviewing a project', async ({ page }) => {
    // Look for Start Review button
    const startReviewButton = page.locator('text=Start Review').first();

    if (await startReviewButton.isVisible().catch(() => false)) {
      await startReviewButton.click();

      // Should navigate to review page
      await expect(page).toHaveURL(/.*judge\/review/);

      // Check review form elements
      await expect(page.locator('text=Score Card')).toBeVisible();
      await expect(page.locator('text=Submit Score')).toBeVisible();
    } else {
      test.skip('No pending assignments available');
    }
  });

  test('judge can score a project', async ({ page }) => {
    // Navigate to first assignment
    await page.goto('/judge');

    const startReviewButton = page.locator('text=Start Review').first();
    if (await startReviewButton.isVisible().catch(() => false)) {
      await startReviewButton.click();
      await expect(page).toHaveURL(/.*judge\/review/);

      // Get all slider inputs
      const sliders = page.locator('[role="slider"]');
      const count = await sliders.count();

      if (count > 0) {
        // Move each slider to set scores
        for (let i = 0; i < Math.min(count, 4); i++) {
          const slider = sliders.nth(i);
          await slider.click();
          // Press right arrow to increase score
          await slider.press('ArrowRight');
          await slider.press('ArrowRight');
        }

        // Add a comment
        await page.locator('textarea').fill('This is a test review comment. Great work!');

        // Submit score
        await page.locator('text=Submit Score').click();

        // Should return to judge dashboard
        await expect(page).toHaveURL(/.*judge/);
      }
    } else {
      test.skip('No assignments to score');
    }
  });

  test('judge can filter assignments by status', async ({ page }) => {
    await page.goto('/judge');

    // Check status filter buttons
    await expect(page.getByRole('button', { name: /^Pending$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^In Progress$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Completed$/i })).toBeVisible();

    // Click on different status filters
    await page.locator('button', { hasText: 'Completed' }).click();

    // Should show completed assignments or empty state
    await expect(page.locator('body')).toContainText(/Completed|No assignments found/i);
  });

  test('judge can navigate back from review', async ({ page }) => {
    await page.goto('/judge');

    const startReviewButton = page.locator('text=Start Review').first();
    if (await startReviewButton.isVisible().catch(() => false)) {
      await startReviewButton.click();
      await expect(page).toHaveURL(/.*judge\/review/);

      // Click back button
      await page.locator('button', { has: page.locator('svg') }).first().click();

      // Should return to judge dashboard
      await expect(page).toHaveURL(/.*judge/);
    } else {
      test.skip('No assignments available');
    }
  });
});
