#!/usr/bin/env node
/**
 * Capture screenshots from a real running OpenHackathon app.
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

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(page, name, waitMs = 1200) {
  await page.setViewportSize(VIEWPORT);
  await page.waitForLoadState('networkidle');
  await sleep(waitMs);

  const path = join(assetsDir, `${name}.png`);
  await page.screenshot({ path, type: 'png' });
  console.log(`📸 ${name}.png`);
}

async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('text=Admin').first().click();
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
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
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'home', 1800);

    await page.goto(`${BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'projects', 1800);

    await page.goto(`${BASE_URL}/leaderboard`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'leaderboard', 1800);

    // Admin pages
    await loginAsAdmin(page);
    await capture(page, 'dashboard', 1800);

    await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'settings', 1800);

    await page.goto(`${BASE_URL}/dashboard/reports`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'features', 1800);

    await page.goto(`${BASE_URL}/dashboard/promotions`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'promotions', 1800);

    await page.goto(`${BASE_URL}/dashboard/judging`, { waitUntil: 'domcontentloaded' });
    await capture(page, 'judging', 1800);

    console.log(`✅ Screenshots saved to ${assetsDir}`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Failed to capture screenshots:', err.message);
  process.exit(1);
});
