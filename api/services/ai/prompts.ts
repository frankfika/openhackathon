/**
 * Centralized prompt templates for the AI document-generation
 * endpoints. Block 3 §3.3 of synth-design-spec.
 *
 * Why this file exists:
 *   * Every prompt is a versioned, testable artifact.
 *   * Variables are rendered through a small templating helper that
 *     supports `{{var}}`, `{{var || 'default'}}`, and
 *     `{{#each list}}…{{/each}}` blocks. The hand-rolled renderer
 *     keeps the dependency surface small.
 *   * No prompt is hard-coded inside the service or the route — the
 *     route passes a typed `PromptContext` and the template decides
 *     how to render it.
 */

export type Language = 'zh' | 'en' | 'both';
export type Tone = 'professional' | 'casual' | 'academic' | 'tech-evangelist';

export interface HackathonPromptContext {
  hackathon?: {
    id: string;
    title: string;
    tagline: string;
    city?: string | null;
    startAt: string;
    endAt: string;
    prizePool?: string | null;
    theme?: string | null;
    tracks?: string[];
  };
  content?: string; // for auto-fill
  projects?: Array<{
    rank: number;
    award: string;
    title: string;
    submitterName: string;
    description?: string | null;
    tags?: string[];
  }>;
  language: Language;
  tone: Tone;
  theme?: string;
  tracks?: string[];
  focus?: string;
  submissionDeadline?: string;
  criterionCount?: number;
  prizePool?: string;
}

export interface PromptTemplate {
  version: string;
  description: string;
  systemPrompt: string;
  userPrompt: (ctx: HackathonPromptContext) => string;
  outputJson: Record<string, unknown>;
}

// ===== Template 1: Hackathon description =====

export const hackathonDescriptionTemplate: PromptTemplate = {
  version: '1.0.0',
  description:
    'Generate a participant-facing description for a hackathon, in zh + en (or just one).',
  systemPrompt: [
    'You are a senior hackathon event copywriter who writes clear, vivid, and',
    'structured participant briefs. Default tone is {{tone}}.',
    'Output JSON with two keys: "zh" and "en". The "zh" value is the Chinese',
    'version of the brief (Markdown, 500-800 字); the "en" value is the English',
    'version (500-800 words). If the requested language is "zh" only, set "en"',
    'to an empty string. If "en" only, set "zh" to an empty string. If "both",',
    'fill both keys.',
  ].join(' '),
  userPrompt: (ctx) => {
    const { hackathon, language, tone, theme, tracks, submissionDeadline, prizePool } = ctx;
    const tracksText = (tracks ?? hackathon?.tracks ?? []).slice(0, 5).join(' / ') || '—';
    return [
      'Generate a hackathon participant brief in {{language}} with tone {{tone}}.',
      '',
      '## Hackathon facts',
      `- Title: ${hackathon?.title || 'TBA'}`,
      `- Tagline: ${hackathon?.tagline || 'TBA'}`,
      `- City: ${hackathon?.city || 'Online'}`,
      `- Start: ${hackathon?.startAt || 'TBA'}`,
      `- End: ${hackathon?.endAt || 'TBA'}`,
      `- Prize pool: ${prizePool || hackathon?.prizePool || 'TBA'}`,
      `- Theme: ${theme || hackathon?.theme || 'TBA'}`,
      `- Tracks: ${tracksText}`,
      `- Submission deadline: ${submissionDeadline || 'TBA'}`,
      '',
      '## Required sections (in this order)',
      '1. Hook (1 short paragraph that earns a second read)',
      '2. Background — why this hackathon, what problem it wants to solve',
      '3. Track overview (1 paragraph per track)',
      '4. Prizes',
      '5. How to register / submit',
      '6. Judging and review process (1 paragraph)',
      '7. Contact and community links',
      '',
      'Output strictly JSON with shape {{outputJsonShape}}.',
    ].join('\n');
  },
  outputJson: {
    type: 'object',
    properties: { zh: { type: 'string' }, en: { type: 'string' } },
    required: ['zh', 'en'],
  },
};

// ===== Template 2: Hackathon news (award winners) =====

export const hackathonNewsTemplate: PromptTemplate = {
  version: '1.0.0',
  description: 'Generate an award-winner news article for a finished hackathon.',
  systemPrompt: [
    'You are a technology journalist who writes energetic, accurate award',
    'announcements. Default tone is {{tone}}.',
    'Output JSON with two keys: "zh" and "en" — fill whichever the language',
    'parameter requests.',
  ].join(' '),
  userPrompt: (ctx) => {
    const { hackathon, projects = [], language, tone, prizePool } = ctx;
    const projectLines = projects
      .map(
        (p) =>
          `- rank ${p.rank} | ${p.title} | award: ${p.award} | team: ${p.submitterName}` +
          (p.description ? ` | blurb: ${String(p.description).slice(0, 200)}` : '') +
          (p.tags?.length ? ` | tags: ${p.tags.join(', ')}` : ''),
      )
      .join('\n');
    return [
      'Generate an award-winner news article for a finished hackathon in {{language}} with tone {{tone}}.',
      '',
      '## Hackathon facts',
      `- Title: ${hackathon?.title || 'TBA'}`,
      `- Start: ${hackathon?.startAt || 'TBA'}`,
      `- End: ${hackathon?.endAt || 'TBA'}`,
      `- Prize pool: ${prizePool || hackathon?.prizePool || 'TBA'}`,
      '',
      '## Awarded projects',
      projectLines || '— no project data —',
      '',
      '## Required sections (in this order)',
      '1. Headline (catchy, includes hackathon name)',
      '2. Lead (200 字 / 200 words, mentions total submissions / participants)',
      '3. First-prize project deep-dive (1 paragraph, includes the technical highlight)',
      '4. Second + third prize shortlist (1 combined paragraph)',
      '5. Judge comments (1 short quote)',
      '6. Outlook (1 paragraph)',
      '',
      'Output strictly JSON with shape {{outputJsonShape}}.',
    ].join('\n');
  },
  outputJson: {
    type: 'object',
    properties: { zh: { type: 'string' }, en: { type: 'string' } },
    required: ['zh', 'en'],
  },
};

// ===== Template 3: Scoring criteria =====

export const hackathonCriteriaTemplate: PromptTemplate = {
  version: '1.0.0',
  description: 'Suggest N scoring criteria for a hackathon (N default 6).',
  systemPrompt: [
    'You are a senior hackathon judge who designs fair, measurable scoring',
    'rubrics. Default tone is {{tone}}. The output is JSON with a "suggestions"',
    'array of exactly {{criterionCount}} items.',
  ].join(' '),
  userPrompt: (ctx) => {
    const { hackathon, theme, focus, criterionCount = 6 } = ctx;
    const finalCount = Math.max(5, Math.min(7, criterionCount));
    return [
      `Recommend ${finalCount} scoring criteria for the following hackathon.`,
      '',
      `Theme: ${theme || hackathon?.theme || 'General'}`,
      `Focus: ${focus || 'Technical innovation, implementation, impact'}`,
      '',
      'Each criterion should include:',
      '- name (3-6 characters for zh, 2-4 words for en)',
      '- weight (integer; the sum of all weights must equal 100)',
      '- maxScore (always 10)',
      '- sortOrder (1-based; matches the recommendation order)',
      '- reasoning (1-2 sentence explanation for the judges)',
      '',
      'Output strictly JSON with shape {{outputJsonShape}}.',
    ].join('\n');
  },
  outputJson: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            weight: { type: 'integer' },
            maxScore: { type: 'integer' },
            sortOrder: { type: 'integer' },
            reasoning: { type: 'string' },
          },
          required: ['name', 'weight', 'maxScore', 'sortOrder', 'reasoning'],
        },
      },
    },
    required: ['suggestions'],
  },
};

// ===== Template 4: Auto-fill hackathon from URL / text =====

export const hackathonAutoFillTemplate: PromptTemplate = {
  version: '1.0.0',
  description: 'Extract structured hackathon info from a URL page or text description.',
  systemPrompt: [
    'You are a precise information extraction assistant.',
    'Extract hackathon details from the provided content and return structured JSON.',
    'For dates, always use ISO 8601 format (YYYY-MM-DD).',
    'For each field, provide a confidence score (0.0-1.0) indicating how certain you are.',
    'If a field is not found in the content, set it to an empty string and give confidence 0.',
    'Be conservative: only fill a field if you are reasonably sure of the value.',
  ].join(' '),
  userPrompt: (ctx) => [
    'Extract hackathon information from the following content:',
    '',
    '---',
    ctx.content || '',
    '---',
    '',
    'Return JSON with shape {{outputJsonShape}}.',
  ].join('\n'),
  outputJson: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Hackathon name / title' },
      tagline: { type: 'string', description: 'Short slogan or tagline' },
      city: { type: 'string', description: 'Host city or Online' },
      startAt: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
      endAt: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      prizePool: { type: 'string', description: 'Prize pool amount or empty' },
      description: { type: 'string', description: 'Full description' },
      externalUrl: { type: 'string', description: 'Original event URL' },
      organizer: { type: 'string', description: 'Host organization name' },
      source: { type: 'string', description: 'Identifier like devpost, dorahacks, custom, or openhackathon' },
      tracks: { type: 'array', items: { type: 'string' }, description: 'Track names or themes' },
      confidence: {
        type: 'object',
        additionalProperties: { type: 'number' },
        description: 'Confidence score 0.0-1.0 for each extracted field',
      },
    },
    required: ['title', 'tagline', 'startAt', 'endAt', 'confidence'],
  },
};

// ===== Template registry =====

export const PROMPT_TEMPLATES = {
  'hackathon-description': hackathonDescriptionTemplate,
  'hackathon-news': hackathonNewsTemplate,
  'hackathon-criteria': hackathonCriteriaTemplate,
  'hackathon-auto-fill': hackathonAutoFillTemplate,
} as const;

export type PromptName = keyof typeof PROMPT_TEMPLATES;

// ===== Tiny Mustache-ish renderer =====
// Supports: {{var}}, {{var || 'default'}}, {{#each list}}…{{/each}}.
// We deliberately keep this small (no Handlebars dep) because the
// prompts above use at most one #each block.

export function renderPrompt(template: string, vars: Record<string, unknown>): string {
  return renderBlock(template, vars, 0).output;
}

interface RenderResult {
  output: string;
  cursor: number;
}

function renderBlock(template: string, vars: Record<string, unknown>, start: number): RenderResult {
  let out = '';
  let cursor = start;
  while (cursor < template.length) {
    const eachMatch = template.slice(cursor).match(/^\{\{#each\s+([\w$.]+)\s*\}\}/);
    if (eachMatch) {
      const listPath = eachMatch[1];
      const blockStart = cursor + eachMatch[0].length;
      const endTag = findMatchingEnd(template, blockStart, 'each');
      if (endTag < 0) {
        throw new Error(`Unclosed {{#each ${listPath}}} block`);
      }
      const blockBody = template.slice(blockStart, endTag);
      const list = resolvePath(vars, listPath);
      if (Array.isArray(list)) {
        for (const item of list) {
          out += renderPrompt(blockBody, { ...vars, this: item, item });
        }
      }
      cursor = endTag + '{{/each}}'.length;
      continue;
    }
    const tokenMatch = template.slice(cursor).match(/^\{\{([^}]+)\}\}/);
    if (tokenMatch) {
      out += renderToken(tokenMatch[1].trim(), vars);
      cursor += tokenMatch[0].length;
      continue;
    }
    const nextOpen = template.indexOf('{{', cursor);
    if (nextOpen === -1) {
      out += template.slice(cursor);
      cursor = template.length;
    } else {
      out += template.slice(cursor, nextOpen);
      cursor = nextOpen;
    }
  }
  return { output: out, cursor };
}

function findMatchingEnd(template: string, start: number, tag: string): number {
  let depth = 1;
  let cursor = start;
  while (cursor < template.length) {
    const open = template.indexOf('{{#each ', cursor);
    const close = template.indexOf('{{/each}}', cursor);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth += 1;
      cursor = open + '{{#each '.length;
    } else {
      depth -= 1;
      cursor = close + '{{/each}}'.length;
      if (depth === 0) return close;
    }
  }
  return -1;
}

function renderToken(token: string, vars: Record<string, unknown>): string {
  // {{var || 'default'}}
  const fallbackMatch = token.match(/^([\w$.]+)\s*\|\|\s*(.+)$/);
  if (fallbackMatch) {
    const [, path, defaultExpr] = fallbackMatch;
    const value = resolvePath(vars, path);
    if (value === undefined || value === null || value === '') {
      return evaluateLiteral(defaultExpr.trim());
    }
    return formatValue(value);
  }
  // {{outputJsonShape}} — convenience
  if (token === 'outputJsonShape') {
    return JSON.stringify({ _renderShape: true });
  }
  const value = resolvePath(vars, token);
  return value === undefined || value === null ? '' : formatValue(value);
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function evaluateLiteral(literal: string): string {
  // Accepts single-quoted or double-quoted strings, otherwise returns the
  // raw expression (e.g. a number).
  if ((literal.startsWith("'") && literal.endsWith("'")) ||
      (literal.startsWith('"') && literal.endsWith('"'))) {
    return literal.slice(1, -1);
  }
  return literal;
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Helper: produce a complete prompt pair (system + user) for a template. */
export function buildPrompt(
  name: PromptName,
  ctx: HackathonPromptContext,
): { system: string; user: string; outputJson: Record<string, unknown>; version: string } {
  const template = PROMPT_TEMPLATES[name];
  const vars: Record<string, unknown> = {
    language: ctx.language,
    tone: ctx.tone,
    criterionCount: ctx.criterionCount ?? 6,
  };
  return {
    system: renderPrompt(template.systemPrompt, vars),
    user: renderPrompt(template.userPrompt(ctx), { ...vars, ...ctx, this: undefined, item: undefined }),
    outputJson: template.outputJson,
    version: template.version,
  };
}
