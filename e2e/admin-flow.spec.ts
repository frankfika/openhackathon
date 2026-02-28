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
    const statValues = page.locator('.text-2xl');
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
    await page.locator('text=Leaderboard').click();
    await expect(page).toHaveURL(/.*dashboard\/leaderboard/);
    await expect(page.locator('text=Leaderboard')).toBeVisible();
  });

  test('admin can view scoring reports', async ({ page }) => {
    await page.locator('text=View Reports').click();
    await expect(page).toHaveURL(/.*dashboard\/reports/);
    await expect(page.locator('text=Scoring Report')).toBeVisible();
  });

  test('admin can access hackathon settings', async ({ page }) => {
    await page.locator('text=Hackathon Settings').click();
    await expect(page).toHaveURL(/.*dashboard\/hackathons\/.*\/settings/);
    await expect(page.locator('text=Settings')).toBeVisible();
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
    await expect(page.locator('text=Judging')).toBeVisible();

    // Should show status filters
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });

  test('admin can filter assignments by status', async ({ page }) => {
    await page.goto('/dashboard/judging');

    // Click on different status filters
    await page.locator('button', { hasText: 'Completed' }).click();

    // Should render completed list or empty state
    await expect(page.locator('body')).toContainText(/Completed|No assignments found|Open review/i);
  });
});
