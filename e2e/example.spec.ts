import { test, expect } from '@playwright/test';

test('basic navigation works', async ({ page }) => {
  await page.goto('https://localhost:5173');
  await expect(page.locator('body')).toContainText('Hackathon');
});