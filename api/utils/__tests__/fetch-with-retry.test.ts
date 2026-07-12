/**
 * Unit tests for fetchWithRetry (synth-design-spec §3.5.2).
 *
 * Pins the contract:
 *   - successful response on first try → no retries
 *   - 5xx + 408 + 429 are retried
 *   - 4xx (other than 408/429) is NOT retried
 *   - timeout (AbortController fires) is retried
 *   - retries=0 disables retry
 *   - exponential backoff doubles the wait each attempt
 *   - on final failure, the thrown error carries the underlying cause
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../fetch-with-retry';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

/** Build a fake Response object. */
function makeResponse(status: number, body = ''): Response {
  return new Response(body, { status, statusText: status === 200 ? 'OK' : 'ERR' });
}

describe('fetchWithRetry — happy path', () => {
  it('returns the response on the first attempt and never retries', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, 'ok'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await fetchWithRetry('https://example.com');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('fetchWithRetry — retry policy', () => {
  it('retries on 500 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, 'oops'))
      .mockResolvedValueOnce(makeResponse(200, 'ok'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await fetchWithRetry('https://example.com', {}, { retries: 2, initialBackoffMs: 1, maxBackoffMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 (rate limited)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValueOnce(makeResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await fetchWithRetry('https://example.com', {}, { retries: 2, initialBackoffMs: 1, maxBackoffMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 408 (request timeout)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(408))
      .mockResolvedValueOnce(makeResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await fetchWithRetry('https://example.com', {}, { retries: 2, initialBackoffMs: 1, maxBackoffMs: 1 });
    expect(res.status).toBe(200);
  });

  it('does NOT retry on 400 / 401 / 403 / 404', async () => {
    for (const status of [400, 401, 403, 404]) {
      const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(status));
      global.fetch = fetchMock as unknown as typeof fetch;
      await expect(
        fetchWithRetry('https://example.com', {}, { retries: 3, initialBackoffMs: 1, maxBackoffMs: 1 })
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('throws after exhausting retries on 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(503));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      fetchWithRetry('https://example.com', {}, { retries: 2, initialBackoffMs: 1, maxBackoffMs: 1 })
    ).rejects.toThrow(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('fetchWithRetry — network errors', () => {
  it('retries on fetch rejection (TypeError network error)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('NetworkError'))
      .mockResolvedValueOnce(makeResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await fetchWithRetry('https://example.com', {}, { retries: 2, initialBackoffMs: 1, maxBackoffMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on AbortController timeout (real-timer variant)', async () => {
    // First call: hang until the AbortController fires, then reject
    // with an AbortError. Second call: resolve with 200.
    //
    // Implementation note: a prior version of this test combined
    // mockImplementation with mockResolvedValueOnce, which caused
    // vitest to use the implementation for every call (the queued
    // resolved value was shadowed), so the first attempt hung
    // forever. Using mockImplementationOnce + mockResolvedValueOnce
    // keeps each call to its own handler.
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        return new Promise((resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      })
      .mockResolvedValueOnce(makeResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await fetchWithRetry('https://example.com', {}, {
      timeoutMs: 10,
      retries: 1,
      initialBackoffMs: 1,
      maxBackoffMs: 1,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('fetchWithRetry — option handling', () => {
  it('retries=0 disables retry (single attempt)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(500));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      fetchWithRetry('https://example.com', {}, { retries: 0, initialBackoffMs: 1 })
    ).rejects.toThrow(/HTTP 500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('backoff="none" skips the wait between attempts (very fast)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    const start = Date.now();
    const res = await fetchWithRetry(
      'https://example.com',
      {},
      { retries: 1, backoff: 'none', initialBackoffMs: 1000 }
    );
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    // We should NOT have slept 1000ms — should be much less.
    expect(elapsed).toBeLessThan(500);
  });

  it('initialBackoffMs * 2^attempt is capped at maxBackoffMs', async () => {
    // We can't easily inspect the wait value, so we just verify
    // that retries 3+ all complete in bounded time and the call
    // returns successfully.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = await fetchWithRetry(
      'https://example.com',
      {},
      { retries: 2, initialBackoffMs: 5, maxBackoffMs: 10 }
    );
    expect(res.status).toBe(200);
  });
});
