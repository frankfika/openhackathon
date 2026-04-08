import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@openhackathon.com');
  await page.locator('input[type="password"]').fill('password');
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('admin shell is accessible after login', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/Hackathon|赛事|Dashboard|仪表盘/i);
  });

  test('admin routes are reachable', async ({ page }) => {
    const routes = [
      '/admin',
      '/admin/projects',
      '/admin/assignments',
      '/admin/judges',
      '/admin/leaderboard',
      '/admin/activity',
      '/admin/settings',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('body')).not.toContainText('404');
      await expect(page.locator('body')).not.toContainText('API route not found');
      await expect(page.locator('main, body')).toBeVisible();
    }
  });

  test('legacy review route redirects to assignments', async ({ page }) => {
    await page.goto('/admin/reviews');
    await expect(page).toHaveURL(/\/admin\/assignments$/);
  });
});
