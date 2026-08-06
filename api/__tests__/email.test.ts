import { describe, expect, it } from 'vitest';
import {
  interpolateEmailTemplate,
  resolveSubmissionEmailPort,
  resolveSubmissionEmailTimeout,
  generateSubmissionReceiptId,
} from '../utils/email';
import { formatReceiptIssuedAt } from '../utils/formatting';

describe('interpolateEmailTemplate', () => {
  it('substitutes named variables', () => {
    const out = interpolateEmailTemplate(
      'Hello {{name}}, your receipt {{receiptId}}',
      { name: 'Alice', receiptId: 'SUB-1' },
    );
    expect(out).toBe('Hello Alice, your receipt SUB-1');
  });

  it('leaves unknown placeholders empty', () => {
    expect(interpolateEmailTemplate('{{unknown}}', {})).toBe('');
  });

  it('tolerates whitespace inside placeholders', () => {
    expect(interpolateEmailTemplate('{{ a }}', { a: 'X' })).toBe('X');
  });
});

describe('resolveSubmissionEmailPort', () => {
  it('returns the parsed positive integer port', () => {
    expect(resolveSubmissionEmailPort('587', 25)).toBe(587);
    expect(resolveSubmissionEmailPort(465, 25)).toBe(465);
  });

  it('falls back when invalid or out of range', () => {
    expect(resolveSubmissionEmailPort('0', 25)).toBe(25);
    expect(resolveSubmissionEmailPort('-1', 25)).toBe(25);
    expect(resolveSubmissionEmailPort('70000', 25)).toBe(25);
    expect(resolveSubmissionEmailPort(undefined, 25)).toBe(25);
    expect(resolveSubmissionEmailPort('not-a-number', 25)).toBe(25);
  });
});

describe('resolveSubmissionEmailTimeout', () => {
  it('returns positive finite numbers floored', () => {
    expect(resolveSubmissionEmailTimeout('1000', 500)).toBe(1000);
    expect(resolveSubmissionEmailTimeout(1000.7, 500)).toBe(1000);
  });

  it('falls back for non-positive / non-finite values', () => {
    expect(resolveSubmissionEmailTimeout('0', 500)).toBe(500);
    expect(resolveSubmissionEmailTimeout('-1', 500)).toBe(500);
    expect(resolveSubmissionEmailTimeout(Infinity, 500)).toBe(500);
    expect(resolveSubmissionEmailTimeout(NaN, 500)).toBe(500);
  });
});

describe('generateSubmissionReceiptId', () => {
  it('matches the SUB-YYYYMMDD-XXXXXX pattern', () => {
    const id = generateSubmissionReceiptId();
    expect(id).toMatch(/^SUB-\d{8}-[A-F0-9]{6}$/);
  });

  it('embeds today\'s UTC date', () => {
    const id = generateSubmissionReceiptId();
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    expect(id).toContain(`${yyyy}${mm}${dd}`);
  });
});

describe('formatReceiptIssuedAt (used by email body)', () => {
  it('renders the issued-at line', () => {
    expect(formatReceiptIssuedAt('2026-07-16T00:00:00.000Z'))
      .toBe('2026-07-16 00:00:00.000 UTC');
  });
});
