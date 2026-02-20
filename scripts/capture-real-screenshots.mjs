#!/usr/bin/env node
/**
 * Capture REAL screenshots from running OpenHackathon app
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const assetsDir = join(rootDir, 'docs', 'assets');

const BASE_URL = 'http://localhost:5173';
const VIEWPORT = { width: 1440, height: 900 };

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name, options = {}) {
  const path = join(assetsDir, `${name}.png`);
  const { wait = 3000, fullPage = false } = options;

  // Wait for network to be idle
  await page.waitForLoadState('networkidle');
  // Additional wait for any animations
  await sleep(wait);
  // Wait for any loading states to finish
  try {
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 5000 });
  } catch (e) {
    // Loading might not exist, that's ok
  }

  if (fullPage) {
    await page.screenshot({ path, type: 'png', fullPage: true });
  } else {
    await page.screenshot({ path, type: 'png', fullPage: false });
  }

  console.log(`📸 Screenshot saved: ${path}`);
  return path;
}

async function captureScreenshots() {
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('🌐 Connecting to app at', BASE_URL);
  console.log('⚠️  Make sure the app is running (npm run dev)');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  try {
    // 1. Landing Page - wait for data to load
    console.log('\n📷 Capturing landing page...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    // Wait for the hackathon data to load (look for a loaded element)
    try {
      await page.waitForSelector('text=Global AI Challenge', { timeout: 10000 });
    } catch (e) {
      console.log('  ⚠️  Hackathon title not found, may still be loading');
    }
    await captureScreenshot(page, 'landing', { wait: 2000 });

    // 2. Login Page
    console.log('📷 Capturing login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'login', { wait: 1000 });

    // Login as admin
    console.log('🔐 Logging in as admin...');
    await page.fill('input[type="email"]', 'admin@openhackathon.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    // Wait for navigation (to either /dashboard or /)
    await sleep(3000);
    // Navigate to dashboard explicitly
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await sleep(2000);

    // 3. Admin Dashboard
    console.log('📷 Capturing admin dashboard...');
    await captureScreenshot(page, 'dashboard', { wait: 2000 });

    // 4. Projects Page
    console.log('📷 Capturing projects page...');
    await page.goto(`${BASE_URL}/dashboard/projects`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'projects', { wait: 3000 });

    // 5. Hackathons Page
    console.log('📷 Capturing hackathons page...');
    await page.goto(`${BASE_URL}/dashboard/hackathons`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'hackathons', { wait: 2000 });

    // 6. Hackathon Settings
    console.log('📷 Capturing hackathon settings...');
    await page.goto(`${BASE_URL}/dashboard/hackathons/hk-global-ai-2026/settings`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'settings', { wait: 2000 });

    // 7. Judging Page
    console.log('📷 Capturing judging page...');
    await page.goto(`${BASE_URL}/dashboard/judging`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'judging', { wait: 2000 });

    // 8. Leaderboard (Public)
    console.log('📷 Capturing leaderboard...');
    await page.goto(`${BASE_URL}/leaderboard`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'leaderboard', { wait: 2000 });

    // 9. Assignment Manager
    console.log('📷 Capturing assignment manager...');
    await page.goto(`${BASE_URL}/dashboard/assignments`, { waitUntil: 'networkidle' });
    await captureScreenshot(page, 'assignments', { wait: 2000 });

    console.log('\n✨ All real screenshots captured!');
    console.log(`📁 Location: ${assetsDir}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the app is running:');
    console.log('   npm run dev');
    console.log('   or');
    console.log('   docker-compose up');
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
