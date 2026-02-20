import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('admin can login and access dashboard', async ({ page }) => {
    await page.goto('/login');

    // Select Admin tab
    await page.locator('text=Admin').click();

    // Fill credentials
    await page.locator('input[type="email"]').fill('admin@openhackathon.com');
    await page.locator('input[type="password"]').fill('password');

    // Submit login
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });

  test('judge can login', async ({ page }) => {
    await page.goto('/login');

    // Select Judge tab
    await page.locator('text=Judge').click();

    // Fill credentials
    await page.locator('input[type="email"]').fill('alice@techgiants.com');
    await page.locator('input[type="password"]').fill('password');

    // Submit login
    await page.locator('button[type="submit"]').click();

    // Wait for navigation - should go to dashboard or home
    await page.waitForLoadState('networkidle');

    // Check we're not on login page anymore
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('should show demo mode indicator', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Demo mode')).toBeVisible();
  });
});