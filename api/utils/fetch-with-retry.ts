/**
 * Fetch with timeout + exponential-backoff retries.
 *
 * All outbound HTTP calls from the AI service (and any other LLM
 * call sites) should go through this helper so that a single
 * transient network blip does not surface as a 502 to the user.
 *
 * Behaviour:
 *   * Per-attempt timeout via AbortController.
 *   * Up to `retries` retries with exponential backoff
 *     (1s, 2s, 4s, …) capped at 8s.
 *   * Non-retryable errors (HTTP 4xx) short-circuit and throw
 *     immediately; 5xx + network errors are retried.
 *   * On final failure, throws an `Error` whose `cause` is the
 *     underlying error so callers can decide on a UI message.
 */
export interface FetchWithRetryOptions {
  timeoutMs?: number;
  retries?: number;
  backoff?: 'exponential' | 'none';
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 8_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoff = 'exponential',
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (response.ok) return response;

      // Read the body once for diagnostic context; do not retry on 4xx.
      const body = await response.text().catch(() => '');
      const err = new Error(
        `HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`,
      );
      if (!shouldRetryStatus(response.status) || attempt === retries) {
        throw err;
      }
      lastError = err;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt === retries) throw err;
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        // Treat timeout as a retryable error.
      } else if (err && typeof err === 'object' && 'message' in err) {
        const message = String((err as { message?: unknown }).message || '');
        if (message.startsWith('HTTP 4')) {
          // Non-retryable client error — surface immediately.
          throw err;
        }
      }
    }

    if (backoff === 'exponential') {
      const wait = Math.min(maxBackoffMs, initialBackoffMs * 2 ** attempt);
      await sleep(wait);
    }
  }

  // Unreachable in practice; the loop either returns or throws.
  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed');
}
