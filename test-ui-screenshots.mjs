// /tmp/test-ui-screenshots.mjs
// Visual consistency test for OpenHackathon new UI components
import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'

const OUT = '/Users/fangchen/.mavis/plans/plan_e118130c/outputs/test-ui/screenshots'
mkdirSync(OUT, { recursive: true })

const BASE = 'http://127.0.0.1:5181'

// Mocked auth context — fake admin user + token injected into localStorage
const FAKE_USER = {
  id: 'user-1',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
}
const FAKE_TOKEN = 'fake-jwt-token-for-test'

// Active hackathon stub (matches Hackathon type: id/title/tagline/startAt/endAt)
const FAKE_HACKATHON = {
  id: 'hack-1',
  title: 'Demo Hackathon',
  tagline: 'AI for Good',
  city: 'Shanghai',
  startAt: '2026-08-01T00:00:00Z',
  endAt: '2026-09-30T00:00:00Z',
  status: 'active',
  description: 'demo',
  descriptionEn: 'demo',
  tracks: ['AI', 'Web3', 'Climate'],
  prizePool: '50000',
  submissionDeadline: '2026-09-30',
  newsZh: '',
  newsEn: '',
  createdAt: '2026-07-01T00:00:00Z',
  coverGradient: 'from-cyan-200 to-blue-300',
}

async function setupAuthContext(context) {
  // Pre-seed localStorage for both roles
  await context.addInitScript(({ user, token }) => {
    localStorage.setItem('openhackathon_admin_user', JSON.stringify(user))
    localStorage.setItem('openhackathon_admin_token', token)
  }, { user: FAKE_USER, token: FAKE_TOKEN })
}

async function setupApiMocks(context) {
  await context.route('**/api/**', async (route) => {
    const url = route.request().url()
    let body
    if (url.includes('/setup/status')) {
      body = { needsSetup: false }
    } else if (url.includes('/site-settings') || url.includes('/settings/site')) {
      body = {
        siteName: 'OpenHackathon',
        tabTitle: 'OpenHackathon',
        seoTitle: 'OpenHackathon',
        seoDescription: 'Open source hackathon platform',
        adminBasePath: '/admin',
        logoUrl: '/openhackathon-logo.svg',
      }
    } else if (url.match(/\/api\/hackathon(\?|$)/)) {
      // matches /api/hackathon (singular — the "current hackathon" endpoint)
      body = FAKE_HACKATHON
    } else if (url.includes('/active-hackathon') || url.includes('/hackathons/active')) {
      body = { hackathon: FAKE_HACKATHON, status: FAKE_HACKATHON.status }
    } else if (url.includes('/auth/me') || url.includes('/users/me')) {
      body = FAKE_USER
    } else if (url.includes('/ai/hackathons/') && url.includes('/generate-description')) {
      // Canned description draft
      body = {
        draft: {
          zh: '# 2026 AI for Good 黑客松\n\n欢迎参加！我们聚焦 AI、Web3、Climate 三大方向。\n\n## 参赛方式\n\n访问官网注册并提交项目。',
          en: '# 2026 AI for Good Hackathon\n\nWelcome! We focus on AI, Web3, and Climate tracks.\n\n## How to Participate\n\nRegister on our site and submit your project.',
        },
        model: 'claude-sonnet-4',
        tokensUsed: 1820,
        latencyMs: 4230,
        logId: 'log-1',
      }
    } else if (url.includes('/ai/hackathons/') && url.includes('/generate-news')) {
      body = {
        draft: {
          zh: '# 获奖名单公布\n\n恭喜以下获奖团队...',
          en: '# Winners Announced\n\nCongratulations to the winning teams...',
        },
        model: 'claude-sonnet-4',
        tokensUsed: 920,
        latencyMs: 2210,
        logId: 'log-2',
      }
    } else if (url.includes('/ai/hackathons/') && url.includes('/suggest-criteria')) {
      body = {
        suggestions: [
          { name: '创新性', weight: 30, maxScore: 10, sortOrder: 1, reasoning: '评估方案的新颖程度和差异化' },
          { name: '技术深度', weight: 30, maxScore: 10, sortOrder: 2, reasoning: '评估实现的技术含量和工程深度' },
          { name: '完成度', weight: 20, maxScore: 10, sortOrder: 3, reasoning: '评估 demo 演示效果' },
          { name: '影响力', weight: 20, maxScore: 10, sortOrder: 4, reasoning: '评估项目的潜在社会价值' },
        ],
        model: 'claude-sonnet-4',
        tokensUsed: 720,
        latencyMs: 1980,
        logId: 'log-3',
      }
    } else if (url.includes('/hackathons') && (url.includes('PUT') || route.request().method() === 'PUT')) {
      body = { ok: true, hackathon: FAKE_HACKATHON }
    } else if (url.match(/\/hackathons\/[^/]+$/)) {
      body = FAKE_HACKATHON
    } else if (url.match(/\/hackathons\?/) || url.endsWith('/hackathons')) {
      body = [FAKE_HACKATHON]
    } else if (url.includes('/ai/scoring-consistency') || url.includes('/consistency')) {
      body = []
    } else if (url.includes('/ai/moderate') || url.includes('/moderate')) {
      body = { isAppropriate: true, suggestedAction: 'approve', flags: [] }
    } else if (url.includes('/ai/optimize')) {
      body = { optimized: '优化后的项目描述...（AI 已润色）' }
    } else {
      body = { ok: true }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

async function setupErrorMock(context) {
  // Override only the generate-description endpoint to return an error
  await context.route('**/api/ai/hackathons/**/generate-description', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'LLM_TIMEOUT',
        message: 'AI service timed out',
      }),
    })
  })
}

async function shot(page, name, opts = {}) {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path, fullPage: opts.fullPage ?? false })
  console.log(`  saved ${path}`)
}

async function shotElement(page, selector, name) {
  const el = page.locator(selector).first()
  await el.waitFor({ state: 'visible', timeout: 5000 })
  const path = `${OUT}/${name}.png`
  await el.screenshot({ path })
  console.log(`  saved ${path} (element ${selector})`)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/fangchen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  })
  console.log('Browser launched')

  // ---------- SCENARIO 1: Login page (light) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await shot(page, '01-login-light-fullpage', { fullPage: true })
    await shotElement(page, 'form', '01-login-light-form')
    await context.close()
  }

  // ---------- SCENARIO 2: Login page (dark) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })
    await setupApiMocks(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await shot(page, '02-login-dark-fullpage', { fullPage: true })
    await context.close()
  }

  // ---------- SCENARIO 3: Judge login (light, mobile-ish form) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/judge/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await shot(page, '03-judge-login-light', { fullPage: true })
    await context.close()
  }

  // ---------- SCENARIO 4: AI Features page (light) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await shot(page, '04-ai-features-light', { fullPage: true })
    // Click "AI 文档生成" → description button to open the modal
    const btn = page.locator('[data-testid="ai-features-description"]')
    await btn.waitFor({ state: 'visible', timeout: 5000 })
    await btn.click()
    await page.waitForTimeout(500)
    await shot(page, '05-ai-modal-form-light', { fullPage: false })
    // Take element-level screenshot of the modal
    await shotElement(page, '[role="dialog"]', '05-ai-modal-form-element')
    await context.close()
  }

  // ---------- SCENARIO 5: AI Modal loading state ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    // Slow down the generate-description endpoint to capture loading state
    await context.route('**/api/ai/hackathons/**/generate-description', async (route) => {
      await new Promise((r) => setTimeout(r, 4000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: { zh: '# 加载完成的草稿', en: '# Loaded draft' },
          model: 'claude-sonnet-4',
          tokensUsed: 1000,
          latencyMs: 4000,
          logId: 'log-loading',
        }),
      })
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const btn = page.locator('[data-testid="ai-features-description"]')
    await btn.click()
    await page.waitForTimeout(300)
    // Click "Generate" inside the modal
    const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first()
    await generateBtn.waitFor({ state: 'visible', timeout: 3000 })
    await generateBtn.click()
    // Wait for loading state
    await page.waitForSelector('[data-testid="ai-loading"]', { timeout: 3000 })
    await page.waitForTimeout(400)
    await shotElement(page, '[role="dialog"]', '06-ai-modal-loading')
    await context.close()
  }

  // ---------- SCENARIO 6: AI Modal error state ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    await setupErrorMock(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const btn = page.locator('[data-testid="ai-features-description"]')
    await btn.click()
    await page.waitForTimeout(300)
    const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first()
    await generateBtn.waitFor({ state: 'visible', timeout: 3000 })
    await generateBtn.click()
    await page.waitForSelector('[data-testid="ai-error"]', { timeout: 5000 })
    await page.waitForTimeout(300)
    await shotElement(page, '[role="dialog"]', '07-ai-modal-error')
    await context.close()
  }

  // ---------- SCENARIO 7: AI Modal preview state (success) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const btn = page.locator('[data-testid="ai-features-description"]')
    await btn.click()
    await page.waitForTimeout(300)
    const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first()
    await generateBtn.waitFor({ state: 'visible', timeout: 3000 })
    await generateBtn.click()
    await page.waitForSelector('[data-testid="ai-preview"]', { timeout: 5000 })
    await page.waitForTimeout(300)
    await shotElement(page, '[role="dialog"]', '08-ai-modal-preview')
    await context.close()
  }

  // ---------- SCENARIO 8: AI Modal preview (dark) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const btn = page.locator('[data-testid="ai-features-description"]')
    await btn.click()
    await page.waitForTimeout(300)
    const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first()
    await generateBtn.waitFor({ state: 'visible', timeout: 3000 })
    await generateBtn.click()
    await page.waitForSelector('[data-testid="ai-preview"]', { timeout: 5000 })
    await page.waitForTimeout(300)
    await shotElement(page, '[role="dialog"]', '09-ai-modal-preview-dark')
    await context.close()
  }

  // ---------- SCENARIO 9: AI Modal criteria mode (light) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const btn = page.locator('[data-testid="ai-features-criteria"]')
    await btn.click()
    await page.waitForTimeout(300)
    const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first()
    await generateBtn.waitFor({ state: 'visible', timeout: 3000 })
    await generateBtn.click()
    await page.waitForSelector('[data-testid="ai-preview"]', { timeout: 5000 })
    await page.waitForTimeout(300)
    await shotElement(page, '[role="dialog"]', '10-ai-modal-criteria-preview')
    await context.close()
  }

  // ---------- SCENARIO 10: Responsive — tablet 768 ----------
  {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, colorScheme: 'light' })
    await setupApiMocks(context)
    await setupAuthContext(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/ai-features`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await shot(page, '11-ai-features-tablet-768', { fullPage: true })
    await context.close()
  }

  // ---------- SCENARIO 11: Login responsive 768 ----------
  {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, colorScheme: 'light' })
    await setupApiMocks(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await shot(page, '12-login-tablet-768', { fullPage: true })
    await context.close()
  }

  // ---------- SCENARIO 12: Loading (route loader) ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
    // Delay the site-settings endpoint to capture loading state
    await context.route('**/api/site-settings**', async (route) => {
      await new Promise((r) => setTimeout(r, 3000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ siteName: 'OpenHackathon', tabTitle: 'OpenHackathon' }),
      })
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'commit' })
    await page.waitForTimeout(800)
    await shot(page, '13-loading-state')
    await context.close()
  }

  await browser.close()
  console.log('All screenshots done')
}

main().catch((err) => {
  console.error('FAIL', err)
  process.exit(1)
})
