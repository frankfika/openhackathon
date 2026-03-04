import { test, expect } from '@playwright/test';

test.describe('Admin Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await page.goto('/login');
    await page.locator('text=Admin').click();
    await page.locator('input[type="email"]').fill('admin@openhackathon.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('admin dashboard shows correct stats', async ({ page }) => {
    await expect(page.getByText(/Admin Dashboard|仪表盘/i)).toBeVisible();
    await expect(page.locator('body')).toContainText(/Projects|项目/i);
    await expect(page.locator('body')).toContainText(/Judges|评委/i);

    // Stats should have numbers
    const statValues = page.locator('.tabular-nums');
    await expect(statValues.first()).toBeVisible();
  });

  test('admin can navigate to hackathons page', async ({ page }) => {
    await page.locator('text=Manage Hackathons').click();
    await expect(page).toHaveURL(/.*dashboard\/hackathons/);
    await expect(page.locator('body')).toContainText(/More Events|Hackathons|活动/i);
  });

  test('admin can view projects list', async ({ page }) => {
    await page.locator('text=View Submissions').click();
    await expect(page).toHaveURL(/.*dashboard\/projects/);
    await expect(page.getByRole('heading', { name: /Projects|项目/i })).toBeVisible();

    // Should show project cards or empty state
    const projectCard = page.locator('.rounded-lg');
    const emptyState = page.locator('text=No projects');
    await expect(projectCard.or(emptyState)).toBeVisible();
  });

  test('admin can view assignment manager', async ({ page }) => {
    await page.locator('text=Assign Projects').click();
    await expect(page).toHaveURL(/.*dashboard\/assignments/);
    await expect(page.getByRole('heading', { name: /Project Assignments|评审分配/i })).toBeVisible();

    // Should show projects and judges panels
    await expect(page.locator('body')).toContainText(/Projects|项目/i);
    await expect(page.locator('body')).toContainText(/Judges|评委/i);
  });

  test('admin can view leaderboard', async ({ page }) => {
    await page.getByRole('link', { name: /^Leaderboard$/i }).click();
    await expect(page).toHaveURL(/.*dashboard\/leaderboard/);
    await expect(page.getByRole('heading', { name: /Leaderboard|榜单/i })).toBeVisible();
  });

  test('admin can view scoring reports', async ({ page }) => {
    await page.locator('text=View Reports').click();
    await expect(page).toHaveURL(/.*dashboard\/reports/);
    await expect(page.locator('text=Scoring Report')).toBeVisible();
  });

  test('admin can access hackathon settings', async ({ page }) => {
    await page.locator('text=Hackathon Settings').click();
    await expect(page).toHaveURL(/.*dashboard\/hackathons\/.*\/settings/);
    await expect(page.getByRole('heading', { name: /Hackathon Settings|黑客松设置/i })).toBeVisible();
  });

  test('admin can assign project to judge', async ({ page }) => {
    await page.goto('/dashboard/assignments');
    await expect(page.locator('text=Project Assignments')).toBeVisible();

    // Look for checkboxes to assign projects
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count > 0) {
      // Toggle first checkbox
      await checkboxes.first().click();

      // Verify assignment was created (checkbox should be checked)
      await expect(checkboxes.first()).toBeChecked();

      // Toggle again to unassign
      await checkboxes.first().click();
      await expect(checkboxes.first()).not.toBeChecked();
    }
  });

  test('admin can view judging page', async ({ page }) => {
    await page.goto('/dashboard/judging');
    await expect(page.getByRole('heading', { name: /Judging|评审/i })).toBeVisible();

    // Should show status filters
    await expect(page.getByRole('button', { name: /^Pending$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^In Progress$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Completed$/i })).toBeVisible();
  });

  test('admin can filter assignments by status', async ({ page }) => {
    await page.goto('/dashboard/judging');

    // Click on different status filters
    await page.locator('button', { hasText: 'Completed' }).click();

    // Should render completed list or empty state
    await expect(page.locator('body')).toContainText(/Completed|No assignments found|Open review/i);
  });

  test('admin can navigate to hackathon settings sessions tab', async ({ page }) => {
    await page.locator('text=Hackathon Settings').click();
    await expect(page).toHaveURL(/.*dashboard\/hackathons\/.*\/settings/);

    // Click the Sessions tab
    await page.getByRole('tab', { name: /Sessions|赛程/i }).click();
    await expect(page.locator('body')).toContainText(/Session Management|赛程管理/i);
  });

  test('admin can create a session with region in sessions tab', async ({ page }) => {
    await page.locator('text=Hackathon Settings').click();
    await expect(page).toHaveURL(/.*dashboard\/hackathons\/.*\/settings/);

    await page.getByRole('tab', { name: /Sessions|赛程/i }).click();
    await page.getByRole('button', { name: /Add Session|添加赛程/i }).click();

    // Fill in the session form
    await page.getByPlaceholder(/e\.g\. Beijing|北京初赛/i).fill('Shenzhen Preliminary');
    await page.locator('input[type="date"]').first().fill('2026-06-01');
    await page.locator('input[type="date"]').last().fill('2026-06-02');

    // Save
    await page.getByRole('button', { name: /^Save$|^保存$/i }).last().click();

    // Session should appear in the list
    await expect(page.locator('body')).toContainText(/Shenzhen Preliminary/i);
  });
});
