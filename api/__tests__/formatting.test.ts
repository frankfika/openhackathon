import { describe, expect, it } from 'vitest';
import { formatReceiptIssuedAt } from '../utils/formatting';

describe('formatReceiptIssuedAt', () => {
  it('formats ISO timestamps with UTC suffix (milliseconds preserved)', () => {
    expect(formatReceiptIssuedAt('2026-07-16T01:23:45.000Z'))
      .toBe('2026-07-16 01:23:45.000 UTC');
  });

  it('returns the input unchanged when invalid', () => {
    expect(formatReceiptIssuedAt('not-a-date')).toBe('not-a-date');
    expect(formatReceiptIssuedAt('')).toBe('');
  });
});
