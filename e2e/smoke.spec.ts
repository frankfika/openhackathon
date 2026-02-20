import { test, expect } from '@playwright/test';

/**
 * Smoke tests - quick tests to verify the application is working
 */
test.describe('Smoke Tests', () => {
  test('application loads without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).not.toContainText('Error');
    await expect(page.locator('body')).not.toContainText('undefined');
  });

  test('all main routes are accessible', async ({ page }) => {
    const routes = ['/', '/projects', '/leaderboard', '/docs', '/login'];

    for (const route of routes) {
      await page.goto(route);
      // Check that page doesn't show 404
      await expect(page.locator('body')).not.toContainText('404');
      // Check that page has content
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('responsive layout works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.locator('body')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow some known warnings but no errors
    const criticalErrors = consoleErrors.filter(
      e => !e.includes('Source map') && !e.includes('Download the React DevTools')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
