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
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Judges')).toBeVisible();
    await expect(page.locator('text=Pending Reviews')).toBeVisible();

    // Stats should have numbers
    const statValues = page.locator('.text-2xl');
    await expect(statValues.first()).toBeVisible();
  });

  test('admin can navigate to hackathons page', async ({ page }) => {
    await page.locator('text=Manage Hackathons').click();
    await expect(page).toHaveURL(/.*dashboard\/hackathons/);
    await expect(page.locator('text=Hackathons')).toBeVisible();
  });

  test('admin can view projects list', async ({ page }) => {
    await page.locator('text=View Submissions').click();
    await expect(page).toHaveURL(/.*dashboard\/projects/);
    await expect(page.locator('text=Projects')).toBeVisible();

    // Should show project cards or empty state
    const projectCard = page.locator('.rounded-lg');
    const emptyState = page.locator('text=No projects');
    await expect(projectCard.or(emptyState)).toBeVisible();
  });

  test('admin can view assignment manager', async ({ page }) => {
    await page.locator('text=Assign Projects').click();
    await expect(page).toHaveURL(/.*dashboard\/assignments/);
    await expect(page.locator('text=Project Assignments')).toBeVisible();

    // Should show projects and judges panels
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Judges')).toBeVisible();
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

    // Should show filtered results or empty state
    const emptyState = page.locator('text=No assignments found');
    const assignmentCard = page.locator('text=Open Review');
    await expect(emptyState.or(assignmentCard)).toBeVisible();
  });
});