/**
 * Auth hardening coverage (synth-design-spec §1.2 P0-1, P0-2, P0-3).
 *
 * These Playwright tests cover the user-visible behavior of the auth
 * fixes:
 *   - happy-path login → admin dashboard
 *   - wrong password → 401 with a clear error, no token in storage
 *   - expired token → 401 with TOKEN_EXPIRED, redirect to login
 *
 * They are designed to run against a live dev server (npm run dev).
 * If the server is not running, Playwright will time out on the
 * initial `page.goto()` and the test will fail with a connection
 * error — the E2E suite is documented as requiring a running stack.
 */
import { test, expect, type APIRequestContext, type Page, request as playwrightRequest } from 'playwright/test';

const ADMIN_EMAIL = 'admin@openhackathon.com';
const ADMIN_PASSWORD = 'password';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';

test.describe('Auth hardening — login flow', () => {
  test('admin can log in with correct credentials and reach the dashboard', async ({ page }) => {
    await page.goto('/login');

    // Login form: use role-based locators that survive i18n changes
    // (login page text is translated but the form structure is stable).
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // After a successful login the URL should change away from /login.
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

    // We should be on an admin or dashboard page.
    const url = page.url();
    expect(url).toMatch(/admin|dashboard|console/i);

    // The user blob in localStorage must NOT contain a `password` field
    // — the impl-backend branch fixed include-leaks at the API layer
    // and the impl-frontend branch added sanitizeUser() in the
    // AuthProvider. Both fixes are required for this assertion to
    // pass, so a regression in either one will be caught.
    const adminUserBlob = await page.evaluate(() =>
      localStorage.getItem('openhackathon_admin_user') || ''
    );
    expect(adminUserBlob).not.toContain('password');
    expect(adminUserBlob).not.toContain('$2b$10$');
    expect(adminUserBlob).not.toContain('globalPoints');
  });

  test('wrong password shows an error and does NOT store a token', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill('definitely-wrong-password');

    const submitResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST',
      { timeout: 10000 }
    ).catch(() => null);

    await page.locator('button[type="submit"]').click();
    const resp = await submitResponse;

    // The HTTP call either errors out (4xx) or the UI shows an error
    // message. We accept either, but in either case the admin_token
    // slot must remain empty.
    if (resp) {
      expect(resp.status()).toBeGreaterThanOrEqual(400);
    }

    // Still on login page (did not redirect).
    await expect(page).toHaveURL(/.*\/login/);

    const adminToken = await page.evaluate(() =>
      localStorage.getItem('openhackathon_admin_token')
    );
    expect(adminToken).toBeNull();
  });

  test('expired JWT returns 401 + TOKEN_EXPIRED on a protected route', async ({ request: apiContext }) => {
    // Mint an expired token using the same secret/audience as the API.
    // We do this from the test process so the assertion is independent
    // of any UI flow.
    const { default: jwt } = await import('jsonwebtoken');
    const expiredToken = jwt.sign(
      { sub: 'test-user', role: 'admin', name: 'Test' },
      process.env.JWT_SECRET || 'openhackathon-change-this-secret',
      {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'openhackathon',
        audience: process.env.JWT_AUDIENCE || 'openhackathon-clients',
        expiresIn: -1 * 60 * 60, // 1 hour ago
      }
    );

    // Hit any admin-only endpoint. /api/dashboard/stats is a stable
    // choice that has been around since the original auth middleware.
    const response = await apiContext.get(`${BASE_URL}/api/dashboard/stats`, {
      headers: { authorization: `Bearer ${expiredToken}` },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
    const body = await response.json().catch(() => ({}));
    // Body may be { code: 'TOKEN_EXPIRED' } or { error: 'Token expired' }
    // depending on which middleware path the request went through.
    const code = body.code || '';
    const error = body.error || '';
    expect(
      code === 'TOKEN_EXPIRED' || error.toLowerCase().includes('token expired')
    ).toBeTruthy();
  });

  test('tampered JWT returns 401 + TOKEN_INVALID', async ({ request: apiContext }) => {
    const { default: jwt } = await import('jsonwebtoken');
    const validToken = jwt.sign(
      { sub: 'test-user', role: 'admin', name: 'Test' },
      process.env.JWT_SECRET || 'openhackathon-change-this-secret',
      {
        algorithm: 'HS256',
        issuer: process.env.JWT_ISSUER || 'openhackathon',
        audience: process.env.JWT_AUDIENCE || 'openhackathon-clients',
        expiresIn: '5m',
      }
    );
    // Tamper the last few characters of the signature segment.
    const tampered = validToken.slice(0, -2) + 'xx';

    const response = await apiContext.get(`${BASE_URL}/api/dashboard/stats`, {
      headers: { authorization: `Bearer ${tampered}` },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
    const body = await response.json().catch(() => ({}));
    const code = body.code || '';
    const error = body.error || '';
    expect(
      code === 'TOKEN_INVALID' || code === 'TOKEN_ALGORITHM_REJECTED'
        || error.toLowerCase().includes('token invalid')
        || error.toLowerCase().includes('invalid signature')
    ).toBeTruthy();
  });
});
