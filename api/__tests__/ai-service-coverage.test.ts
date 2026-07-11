/**
 * Unit tests for AIService (api/services/ai.ts) — focused on the new
 * callStructured path used by the Block 3 endpoints
 * (synth-design-spec §3.2 / §3.5).
 *
 * The class has a provider-specific code path (Claude / OpenAI /
 * local). The tests here exercise the LLM_INVALID_KEY early-exit
 * path that is hit whenever AI_API_KEY is unset (the default in
 * test envs) and verify:
 *   - callStructured throws with code 'LLM_INVALID_KEY' when no key
 *   - The error has a human-readable message
 *   - getAIService() caches the singleton
 *   - getDefaultModel returns the documented model for each provider
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIService, getAIService } from '../services/ai';

describe('AIService — callStructured error path', () => {
  beforeEach(() => {
    // Ensure the env vars are cleared so the service sees "no key".
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  it('throws LLM_INVALID_KEY when ANTHROPIC_API_KEY is unset (default claude provider)', async () => {
    const service = new AIService({ provider: 'claude' });
    let err: { code?: string; message?: string } | null = null;
    try {
      await service.callStructured('hackathon-description', {
        hackathon: {
          id: 'h1',
          title: 'T',
          tagline: 'tl',
          startAt: '2026-09-01T00:00:00Z',
          endAt: '2026-09-03T00:00:00Z',
        },
        language: 'en',
        tone: 'professional',
      });
    } catch (e) {
      err = e as { code?: string; message?: string };
    }
    expect(err).toBeTruthy();
    expect(err!.code).toBe('LLM_INVALID_KEY');
    expect(String(err!.message)).toMatch(/API_KEY/);
  });

  it('throws LLM_INVALID_KEY when OPENAI_API_KEY is unset (openai provider)', async () => {
    const service = new AIService({ provider: 'openai' });
    let err: { code?: string; message?: string } | null = null;
    try {
      await service.callStructured('hackathon-news', {
        hackathon: {
          id: 'h1',
          title: 'T',
          tagline: 'tl',
          startAt: '2026-09-01T00:00:00Z',
          endAt: '2026-09-03T00:00:00Z',
        },
        language: 'en',
        tone: 'professional',
      });
    } catch (e) {
      err = e as { code?: string; message?: string };
    }
    expect(err).toBeTruthy();
    expect(err!.code).toBe('LLM_INVALID_KEY');
  });

  it('does not throw LLM_INVALID_KEY for the local provider (no key required)', async () => {
    const service = new AIService({ provider: 'local' });
    // We don't make a real call here — we just want to confirm the
    // early-exit path is bypassed for local. Stub the fetch so the
    // call doesn't actually hit the network.
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await service.callStructured('hackathon-criteria', {
        hackathon: {
          id: 'h1',
          title: 'T',
          tagline: 'tl',
          startAt: '2026-09-01T00:00:00Z',
          endAt: '2026-09-03T00:00:00Z',
        },
        language: 'en',
        tone: 'professional',
      });
    } catch (e) {
      // The OpenAI-compatible /chat/completions response shape is
      // "choices[0].message.content" — our stub returns "{}" which
      // is NOT valid JSON for the schema, so this WILL throw, but
      // NOT with LLM_INVALID_KEY. We only care that we did NOT see
      // the missing-key error.
      const code = (e as { code?: string }).code;
      expect(code).not.toBe('LLM_INVALID_KEY');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('getAIService — singleton cache', () => {
  it('returns the same instance on repeat calls', () => {
    const a = getAIService();
    const b = getAIService();
    expect(a).toBe(b);
  });

  it('produces an instance of AIService', () => {
    const a = getAIService();
    expect(a).toBeInstanceOf(AIService);
  });
});

describe('AIService — provider default models', () => {
  it('claude → claude-sonnet-4-20250514', () => {
    const service = new AIService({ provider: 'claude' });
    expect((service as unknown as { config: { model: string } }).config.model).toBe('claude-sonnet-4-20250514');
  });

  it('openai → gpt-4o', () => {
    const service = new AIService({ provider: 'openai' });
    expect((service as unknown as { config: { model: string } }).config.model).toBe('gpt-4o');
  });

  it('explicit model overrides the default', () => {
    const service = new AIService({ provider: 'claude', model: 'claude-opus-4-20250514' });
    expect((service as unknown as { config: { model: string } }).config.model).toBe('claude-opus-4-20250514');
  });
});
