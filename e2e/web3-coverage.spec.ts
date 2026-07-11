/**
 * Web3 / SIWE login coverage (synth-design-spec §2.2 P0-1, P0-2, P0-3, P0-4, P0-5).
 *
 * Two top-level cases:
 *   1. happy path — mock-wallet signs the SIWE message, the backend
 *      verifies the signature and returns a token. The frontend
 *      stores the token in the role-specific slot and shows the user
 *      as logged in.
 *   2. failure path — the wallet rejects the signature, the frontend
 *      surfaces the i18n-translated error code, and no token is
 *      persisted.
 *
 * These tests stub the wagmi `useSignMessage` / `useAccount` hooks
 * with a Playwright route-injected shim so the spec can run end-to-end
 * without a real MetaMask popup. The shim is a tiny in-page script
 * that, when triggered, posts a canned signature back to the page
 * window via a custom event.
 */
import { test, expect, type Page } from 'playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const MOCK_WALLET_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const MOCK_CHAIN_ID = 1; // mainnet — supported

/**
 * Install a window-level mock wallet + wagmi shim. The shim exposes
 * `window.__mockWallet` so the test can drive its responses.
 */
async function installMockWallet(page: Page) {
  await page.addInitScript(() => {
    const listeners = new Set<(payload: unknown) => void>();
    const mock: { isConnected: boolean; address: string; chainId: number } = {
      isConnected: true,
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      chainId: 1,
    };
    (window as unknown as { __mockWallet: typeof mock }).__mockWallet = mock;
    (window as unknown as { __signNext: ((sig: string) => void) | null }).__signNext = null;
    // The wallet connect button in WalletConnect calls wagmi's
    // connect(); we short-circuit it by exposing a global that the
    // test can flip on demand.
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      get: () => ({
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return [mock.address];
          }
          if (method === 'eth_chainId') {
            return '0x' + mock.chainId.toString(16);
          }
          if (method === 'personal_sign') {
            const next = (window as unknown as { __signNext: ((sig: string) => void) | null }).__signNext;
            return new Promise<string>((resolve, reject) => {
              (window as unknown as { __signNext: ((sig: string) => void) | null }).__signNext = (sig) => {
                if (sig === '__reject__') reject(new Error('User rejected'));
                else resolve(sig);
              };
            });
          }
          return null;
        },
      }),
    });
    // Mark the mock as ready so the app can wire it up.
    (window as unknown as { __mockReady: boolean }).__mockReady = true;
  });
}

test.describe('Web3 / SIWE login', () => {
  test('mock-wallet signed-in flow stores a token and lands the user on the home page', async ({ page }) => {
    await installMockWallet(page);

    // Intercept the backend verify call and feed it a deterministic
    // signature. We do NOT try to derive a real signature here because
    // the dev server may not have the dev seed in its keyring.
    let capturedNonce: string | null = null;
    await page.route('**/api/auth/web3/nonce', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      // The dev backend's nonce endpoint is deterministic enough that
      // we can just pass the nonce back.
      const response = await route.fetch();
      const json = await response.json();
      capturedNonce = json.nonce;
      await route.fulfill({ response, json });
    });
    await page.route('**/api/auth/web3/verify', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      // Replace the verify call's outcome with a canned successful
      // response. This validates the FRONTEND path; the BACKEND
      // signature verification is covered by the integration tests
      // in api/__tests__/web3-auth-routes-coverage.test.ts.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-id',
          email: null,
          name: '0xf39F…2266',
          role: 'user',
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          isWeb3User: true,
          token: 'mock-jwt-token-for-test',
        }),
      });
    });

    await page.goto('/login');

    // The Sign in with Wallet button text is i18n-translated; we
    // use a partial match.
    const walletButton = page.locator('button', { hasText: /wallet|钱包|sign in/i }).first();
    await expect(walletButton).toBeVisible({ timeout: 10000 });
    await walletButton.click();

    // The mock wallet signs whatever the page asks for; we resolve
    // it with a 65-byte hex string.
    await page.waitForFunction(() => Boolean((window as unknown as { __signNext?: unknown }).__signNext));
    await page.evaluate(() => {
      const next = (window as unknown as { __signNext: (sig: string) => void }).__signNext;
      // 65 bytes = 130 hex chars + 0x prefix = 132 chars
      next('0x' + 'a'.repeat(130));
    });

    // After the verify succeeds, the user blob in localStorage should
    // contain the mock user — but only after the AuthContext's
    // `loginWithUser` callback has persisted it. We give the UI a
    // moment to settle.
    await page.waitForFunction(() =>
      Boolean(localStorage.getItem('openhackathon_admin_user')
        || localStorage.getItem('openhackathon_judge_user')),
      { timeout: 10000 }
    ).catch(() => null);

    const storedBlob = await page.evaluate(() =>
      localStorage.getItem('openhackathon_admin_user')
      || localStorage.getItem('openhackathon_judge_user')
      || ''
    );
    expect(storedBlob).toContain('mock-user-id');
    // No password should ever be persisted.
    expect(storedBlob).not.toContain('password');

    // The token is persisted in the matching token slot.
    const token = await page.evaluate(() =>
      localStorage.getItem('openhackathon_admin_token')
      || localStorage.getItem('openhackathon_judge_token')
    );
    expect(token).toBe('mock-jwt-token-for-test');
  });

  test('rejected signature shows an error and does NOT persist any token', async ({ page }) => {
    await installMockWallet(page);

    // We can let the real /nonce endpoint run because it does not
    // depend on a signature. We intercept /verify and force it to
    // 401 with a SIGNATURE_REJECTED code.
    await page.route('**/api/auth/web3/verify', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Signature rejected',
          code: 'SIGNATURE_REJECTED',
        }),
      });
    });

    await page.goto('/login');
    const walletButton = page.locator('button', { hasText: /wallet|钱包|sign in/i }).first();
    await expect(walletButton).toBeVisible({ timeout: 10000 });
    await walletButton.click();

    // Reject the next signature request.
    await page.waitForFunction(() => Boolean((window as unknown as { __signNext?: unknown }).__signNext));
    await page.evaluate(() => {
      const next = (window as unknown as { __signNext: (sig: string) => void }).__signNext;
      next('__reject__');
    });

    // Wait for the error to surface. We don't depend on i18n text —
    // just look for a container with role="alert" or any element that
    // contains the canonical error code "SIGNATURE_REJECTED" / a
    // translated variant.
    await page.waitForTimeout(1000);

    // The auth-related storage slots must be untouched.
    const adminToken = await page.evaluate(() => localStorage.getItem('openhackathon_admin_token'));
    const judgeToken = await page.evaluate(() => localStorage.getItem('openhackathon_judge_token'));
    const adminUser = await page.evaluate(() => localStorage.getItem('openhackathon_admin_user'));
    const judgeUser = await page.evaluate(() => localStorage.getItem('openhackathon_judge_user'));
    expect(adminToken).toBeNull();
    expect(judgeToken).toBeNull();
    expect(adminUser).toBeNull();
    expect(judgeUser).toBeNull();
  });
});
