/**
 * Unit tests for the prompt templates (synth-design-spec §3.3).
 *
 * The templates are versioned, file-level constants — the unit
 * tests in this file pin down:
 *   - each template's version, system prompt, and output JSON shape
 *   - the renderer can substitute {{var}}, {{var || 'default'}},
 *     and {{#each list}}…{{/each}} blocks
 *   - buildPrompt() returns a complete { system, user, outputJson, version }
 *     bundle for each template name
 */
import { describe, expect, it } from 'vitest';
import {
  PROMPT_TEMPLATES,
  buildPrompt,
  hackathonCriteriaTemplate,
  hackathonDescriptionTemplate,
  hackathonNewsTemplate,
  renderPrompt,
  type HackathonPromptContext,
} from '../../services/ai/prompts';

const baseHackathon = {
  id: 'h-1',
  title: 'OpenHack 2026',
  tagline: 'Build fast',
  city: 'San Francisco',
  startAt: '2026-09-01T09:00:00Z',
  endAt: '2026-09-03T18:00:00Z',
  prizePool: '50,000 USDC',
  theme: 'Web3 identity',
  tracks: ['DePIN', 'ZK'] as string[],
};

describe('Prompt template registry', () => {
  it('exports the named templates referenced by the routes', () => {
    expect(Object.keys(PROMPT_TEMPLATES).sort()).toEqual([
      'hackathon-auto-fill',
      'hackathon-criteria',
      'hackathon-description',
      'hackathon-news',
    ]);
  });
  it('exports the named templates referenced by the routes', () => {
    expect(Object.keys(PROMPT_TEMPLATES).sort()).toEqual([
      'hackathon-auto-fill',
      'hackathon-criteria',
      'hackathon-description',
      'hackathon-news',
    ]);
  });
  it('each template carries a semver version string', () => {
    for (const t of Object.values(PROMPT_TEMPLATES)) {
      expect(t.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('each template has a description, systemPrompt, userPrompt, and outputJson', () => {
    for (const t of Object.values(PROMPT_TEMPLATES)) {
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.systemPrompt).toBe('string');
      expect(t.systemPrompt.length).toBeGreaterThan(0);
      expect(typeof t.userPrompt).toBe('function');
      expect(typeof t.outputJson).toBe('object');
    }
  });
});

describe('renderPrompt — variable substitution', () => {
  it('substitutes a {{var}} token', () => {
    expect(renderPrompt('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('substitutes a {{var || "default"}} token when var is undefined', () => {
    expect(renderPrompt('{{x || "fallback"}}', {})).toBe('fallback');
  });

  it('substitutes a {{var || "default"}} token when var is empty string', () => {
    expect(renderPrompt('{{x || "fallback"}}', { x: '' })).toBe('fallback');
  });

  it('substitutes a {{var || "default"}} token when var is null', () => {
    expect(renderPrompt('{{x || "fallback"}}', { x: null })).toBe('fallback');
  });

  it('uses the actual value when var is truthy', () => {
    expect(renderPrompt('{{x || "fallback"}}', { x: 'real' })).toBe('real');
  });

  it('substitutes a number value as its string form', () => {
    expect(renderPrompt('count: {{n}}', { n: 42 })).toBe('count: 42');
  });

  it('resolves dotted paths', () => {
    expect(renderPrompt('{{a.b}}', { a: { b: 'c' } })).toBe('c');
  });

  it('substitutes a {{#each list}}…{{/each}} block', () => {
    const out = renderPrompt('{{#each items}}<{{this}}>{{/each}}', { items: ['a', 'b', 'c'] });
    expect(out).toBe('<a><b><c>');
  });

  it('renders an empty string for an empty list', () => {
    const out = renderPrompt('[{{#each items}}{{this}}{{/each}}]', { items: [] });
    expect(out).toBe('[]');
  });

  it('renders an empty string for a missing list (undefined)', () => {
    const out = renderPrompt('[{{#each items}}{{this}}{{/each}}]', {});
    expect(out).toBe('[]');
  });

  it('rejects an unclosed each block', () => {
    expect(() => renderPrompt('{{#each xs}}oops', {})).toThrow(/Unclosed/);
  });

  it('passes the each item as `this` AND `item`', () => {
    // Template has a trailing `|` after `{{item}}` so each iteration
    // produces `<item>|<item>|`. Two iterations of xs=['a','b'] give
    // `a|a|b|b|`. The trailing `|` proves the loop ran twice and
    // that BOTH `{{this}}` and `{{item}}` resolved to the same
    // value within a single iteration.
    const out = renderPrompt('{{#each xs}}{{this}}|{{item}}|{{/each}}', { xs: ['a', 'b'] });
    expect(out).toBe('a|a|b|b|');
  });

  it('substitutes the special {{outputJsonShape}} token', () => {
    const out = renderPrompt('{{outputJsonShape}}', {});
    expect(JSON.parse(out)).toEqual({ _renderShape: true });
  });

  it('substitutes multiple tokens in a single string', () => {
    expect(renderPrompt('{{a}}-{{b}}-{{c}}', { a: '1', b: '2', c: '3' })).toBe('1-2-3');
  });

  it('returns "" for a missing top-level var (not the key string)', () => {
    expect(renderPrompt('x={{missing}}', {})).toBe('x=');
  });
});

describe('buildPrompt — hackathon-description', () => {
  const ctx: HackathonPromptContext = {
    hackathon: { ...baseHackathon },
    language: 'both',
    tone: 'professional',
    theme: 'Web3 identity',
    tracks: ['DePIN', 'ZK'],
    submissionDeadline: '2026-09-15T23:59:00Z',
    prizePool: '50,000 USDC',
  };

  it('returns a complete { system, user, outputJson, version } bundle', () => {
    const out = buildPrompt('hackathon-description', ctx);
    expect(out.version).toBe(hackathonDescriptionTemplate.version);
    expect(out.system).toContain('professional');
    expect(out.user).toContain('OpenHack 2026');
    expect(out.user).toContain('DePIN');
    expect(out.user).toContain('50,000 USDC');
    expect(out.outputJson).toMatchObject({
      type: 'object',
      properties: { zh: { type: 'string' }, en: { type: 'string' } },
    });
  });

  it('renders tracks in zh-style slash-separated form when both languages are requested', () => {
    const out = buildPrompt('hackathon-description', ctx);
    expect(out.user).toMatch(/DePIN\s*\/\s*ZK/);
  });

  it('substitutes {{language}} from the context, not from the wrapper', () => {
    const zhOnly = buildPrompt('hackathon-description', { ...ctx, language: 'zh' });
    expect(zhOnly.user).toContain('Generate a hackathon participant brief in zh');
  });
});

describe('buildPrompt — hackathon-news', () => {
  const ctx: HackathonPromptContext = {
    hackathon: { ...baseHackathon },
    language: 'both',
    tone: 'professional',
    projects: [
      { rank: 1, award: 'Gold', title: 'Aether', submitterName: 'Team Aether', description: 'A privacy-preserving identity layer.', tags: ['ZK', 'identity'] },
      { rank: 2, award: 'Silver', title: 'Bridge', submitterName: 'Team Bridge', description: 'A cross-chain bridge prototype.' },
    ],
  };

  it('renders the awarded-project list with rank/title/award/team/tags', () => {
    const out = buildPrompt('hackathon-news', ctx);
    expect(out.user).toContain('rank 1');
    expect(out.user).toContain('Aether');
    expect(out.user).toContain('Gold');
    expect(out.user).toContain('Team Aether');
    expect(out.user).toContain('ZK, identity');
  });

  it('still renders when no projects are present (defensive fallback)', () => {
    const out = buildPrompt('hackathon-news', { ...ctx, projects: [] });
    expect(out.user).toContain('— no project data —');
  });

  it('includes the hackathon name and dates in the user prompt', () => {
    const out = buildPrompt('hackathon-news', ctx);
    expect(out.user).toContain('OpenHack 2026');
    expect(out.user).toContain('2026-09-01T09:00:00Z');
  });
});

describe('buildPrompt — hackathon-criteria', () => {
  const ctx: HackathonPromptContext = {
    hackathon: { ...baseHackathon },
    language: 'en',
    tone: 'professional',
    theme: 'Web3 identity',
    focus: 'Innovation + execution',
    criterionCount: 6,
  };

  it('clamps criterionCount to the 5-7 range', () => {
    const out = buildPrompt('hackathon-criteria', { ...ctx, criterionCount: 3 });
    expect(out.user).toMatch(/Recommend 5/);
    const out2 = buildPrompt('hackathon-criteria', { ...ctx, criterionCount: 99 });
    expect(out2.user).toMatch(/Recommend 7/);
  });

  it('falls back to 6 when criterionCount is undefined', () => {
    const out = buildPrompt('hackathon-criteria', { ...ctx, criterionCount: undefined });
    expect(out.user).toMatch(/Recommend 6/);
  });

  it('the output JSON shape is the suggestions array envelope', () => {
    const out = buildPrompt('hackathon-criteria', ctx);
    expect(out.outputJson).toMatchObject({
      type: 'object',
      properties: { suggestions: { type: 'array' } },
    });
  });

  it('includes the theme and focus in the user prompt', () => {
    const out = buildPrompt('hackathon-criteria', ctx);
    expect(out.user).toContain('Web3 identity');
    expect(out.user).toContain('Innovation + execution');
  });
});

describe('output JSON shape is required-key consistent', () => {
  it('hackathon-description requires zh and en', () => {
    expect(hackathonDescriptionTemplate.outputJson).toMatchObject({
      required: expect.arrayContaining(['zh', 'en']),
    });
  });

  it('hackathon-news requires zh and en', () => {
    expect(hackathonNewsTemplate.outputJson).toMatchObject({
      required: expect.arrayContaining(['zh', 'en']),
    });
  });

  it('hackathon-criteria requires a suggestions array', () => {
    expect(hackathonCriteriaTemplate.outputJson).toMatchObject({
      required: expect.arrayContaining(['suggestions']),
    });
  });
});
