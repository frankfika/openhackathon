import { test, expect } from 'playwright/test';

test('basic navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/OpenHackathon|Hackathon/i);
});
