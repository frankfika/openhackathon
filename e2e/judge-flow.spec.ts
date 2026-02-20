import { test, expect } from '@playwright/test';

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
    // Check dashboard stats cards
    await expect(page.locator('text=Pending Reviews')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();

    // Check stats have numbers
    const pendingCard = page.locator('.text-2xl', { hasText: /^\d+$/ }).first();
    await expect(pendingCard).toBeVisible();
  });

  test('judge can view judging queue', async ({ page }) => {
    // Check Judging Queue section
    await expect(page.locator('text=Judging Queue')).toBeVisible();
    await expect(page.locator('text=Projects assigned to you for review')).toBeVisible();

    // Check for Start Review buttons or empty state
    const startReviewButton = page.locator('text=Start Review');
    const emptyState = page.locator('text=No pending assignments');

    await expect(startReviewButton.or(emptyState)).toBeVisible();
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
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();

    // Click on different status filters
    await page.locator('button', { hasText: 'Completed' }).click();

    // Should show completed assignments or empty state
    const completedBadge = page.locator('text=Completed');
    const emptyState = page.locator('text=No assignments found');
    await expect(completedBadge.or(emptyState)).toBeVisible();
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