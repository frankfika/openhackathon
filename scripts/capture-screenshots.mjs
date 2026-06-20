#!/usr/bin/env node
/**
 * Capture screenshots from a real running OpenHackathon app.
 *
 * Requirements:
 *   - The app must be running (npm run dev)
 *   - Playwright browsers must be installed (npx playwright install)
 *
 * Usage:
 *   BASE_URL=http://localhost:5173 node scripts/capture-screenshots.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const assetsDir = join(rootDir, 'docs', 'assets');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const VIEWPORT = { width: 1280, height: 800 };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@openhackathon.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const JUDGE_EMAIL = process.env.JUDGE_EMAIL || 'alice@techgiants.com';
const JUDGE_PASSWORD = process.env.JUDGE_PASSWORD || 'password';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(page, name, waitMs = 1500) {
  await page.setViewportSize(VIEWPORT);
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  } catch {
    // ignore pages with long polling
  }
  await sleep(waitMs);

  const path = join(assetsDir, `${name}.png`);
  await page.screenshot({ path, type: 'png' });
  console.log(`📸 ${name}.png`);
}

async function isLoggedInAsAdmin(page) {
  try {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    const url = page.url();
    return url.includes('/admin') && !url.includes('/login');
  } catch {
    return false;
  }
}

async function loginAsAdmin(page) {
  const alreadyLoggedIn = await isLoggedInAsAdmin(page);
  if (alreadyLoggedIn) return;

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 20000 });
  await sleep(1000);
}

async function loginAsJudge(page) {
  await page.goto(`${BASE_URL}/judge/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(JUDGE_EMAIL);
  await page.locator('input[type="password"]').fill(JUDGE_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/judge(\/|$)/, { timeout: 20000 });
  await sleep(1000);
}

async function run() {
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log(`Using BASE_URL=${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // Public pages
    console.log('\n🌐 Capturing public pages...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'home', 2000);

    await page.goto(`${BASE_URL}/submit`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'submit', 1500);

    await page.goto(`${BASE_URL}/leaderboard`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'leaderboard', 1500);

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'login', 1500);

    await page.goto(`${BASE_URL}/judge/login`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'judge-login', 1500);

    // Admin pages
    console.log('\n🔐 Capturing admin pages...');
    await loginAsAdmin(page);
    await capture(page, 'dashboard', 2000);

    await page.goto(`${BASE_URL}/admin/projects`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'projects', 2000);

    await page.goto(`${BASE_URL}/admin/assignments`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'assignments', 2000);
    await capture(page, 'features', 2000);

    await page.goto(`${BASE_URL}/admin/judges`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'judges', 2000);

    await page.goto(`${BASE_URL}/admin/hackathons`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'hackathons', 2000);

    // Navigate to the seeded hackathon's settings page
    console.log('📷 Capturing hackathon settings...');
    try {
      await page.goto(`${BASE_URL}/admin/hackathons/hk-openhack-2026/settings`, { waitUntil: 'domcontentloaded' });
      await capture(page, 'settings', 2000);

      const submissionTab = page.locator('button[role="tab"]', { hasText: /Submission|提交表单/ }).first();
      if (await submissionTab.count() > 0) {
        await submissionTab.click();
        await sleep(800);
        await capture(page, 'submission-form', 2000);
      }

      const scoringTab = page.locator('button[role="tab"]', { hasText: /Scoring|评分标准/ }).first();
      if (await scoringTab.count() > 0) {
        await scoringTab.click();
        await sleep(800);
        await capture(page, 'scoring', 2000);
      }
    } catch {
      console.log('  ⚠️  Could not capture hackathon settings, skipping');
    }

    await page.goto(`${BASE_URL}/admin/leaderboard`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'leaderboard-admin', 2000);

    await page.goto(`${BASE_URL}/admin/activity`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'activity', 2000);

    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'site-settings', 2000);

    await page.goto(`${BASE_URL}/admin/ai-features`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'ai-features', 2000);

    // Judge workspace
    console.log('\n⚖️  Capturing judge workspace...');
    try {
      await loginAsJudge(page);
      await capture(page, 'judging', 2000);
    } catch (err) {
      console.log(`  ⚠️  Could not capture judge workspace: ${err.message}`);
    }

    console.log(`\n✅ Screenshots saved to ${assetsDir}`);
  } catch (err) {
    console.error('\n❌ Failed to capture screenshots:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
