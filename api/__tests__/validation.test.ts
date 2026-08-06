import { describe, expect, it } from 'vitest';
import {
  normalizeEmail,
  isValidEmail,
  isValidHttpUrl,
  isValidHttpOrRootRelativeUrl,
  isValidPassword,
  asUserRole,
  getErrorMessage,
  dedupeIds,
  normalizeScoringCriteriaPayload,
  normalizeAdminBasePath,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_URL_LENGTH,
  MAX_SEARCH_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_COUNT,
  truncateString,
  validateSearchInput,
} from '../utils/validation';

describe('normalizeEmail', () => {
  it('lowercases valid strings', () => {
    expect(normalizeEmail('Foo@Bar.COM')).toBe('foo@bar.com');
  });

  it('returns undefined for empty or non-string', () => {
    expect(normalizeEmail('')).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
    expect(normalizeEmail(null)).toBeUndefined();
    expect(normalizeEmail(42)).toBeUndefined();
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('user.name+tag@sub.domain.io')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidEmail('no-at-symbol')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a @b.co')).toBe(false);
  });
});

describe('isValidHttpUrl', () => {
  it('accepts http/https URLs', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
    expect(isValidHttpUrl('http://localhost:3001')).toBe(true);
  });

  it('rejects non-http protocols and malformed strings', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });
});

describe('isValidHttpOrRootRelativeUrl', () => {
  it('allows http(s) and root-relative paths', () => {
    expect(isValidHttpOrRootRelativeUrl('https://example.com')).toBe(true);
    expect(isValidHttpOrRootRelativeUrl('/admin/login')).toBe(true);
  });

  it('rejects protocol-relative paths and other protocols', () => {
    expect(isValidHttpOrRootRelativeUrl('//evil.example.com')).toBe(false);
    expect(isValidHttpOrRootRelativeUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts 8+ chars with upper/lower/digit', () => {
    expect(isValidPassword('Abcdefg1')).toBe(true);
    expect(isValidPassword('Aa1aaaaa')).toBe(true);
  });

  it('rejects too short, too long, or missing classes', () => {
    expect(isValidPassword('Short1')).toBe(false);
    expect(isValidPassword('allowercase1')).toBe(false);
    expect(isValidPassword('ALLUPPER1')).toBe(false);
    expect(isValidPassword('NoDigitsHere')).toBe(false);
    expect(isValidPassword('Aa1' + 'a'.repeat(70))).toBe(false);
  });
});

describe('asUserRole', () => {
  it('returns the role when admin or judge', () => {
    expect(asUserRole('admin')).toBe('admin');
    expect(asUserRole('judge')).toBe('judge');
  });

  it('returns null for anything else', () => {
    expect(asUserRole('user')).toBeNull();
    expect(asUserRole(undefined)).toBeNull();
    expect(asUserRole(null)).toBeNull();
    expect(asUserRole(42)).toBeNull();
    expect(asUserRole('Admin')).toBeNull();
  });
});

describe('getErrorMessage', () => {
  it('extracts message from Error-shaped objects', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('falls back when message is missing or non-string', () => {
    expect(getErrorMessage({}, 'fallback')).toBe('fallback');
    expect(getErrorMessage({ message: '' }, 'fallback')).toBe('fallback');
    expect(getErrorMessage({ message: 42 }, 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('dedupeIds', () => {
  it('removes duplicates and falsy entries', () => {
    expect(dedupeIds(['a', 'b', 'a', '', null, 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty input', () => {
    expect(dedupeIds([])).toEqual([]);
  });
});

describe('normalizeScoringCriteriaPayload', () => {
  it('returns error for non-array or non-object entries', () => {
    expect(normalizeScoringCriteriaPayload([]).criteria).toEqual([]);
    expect(normalizeScoringCriteriaPayload([null]).error).toBeDefined();
    expect(normalizeScoringCriteriaPayload([{ name: 'X' }]).error).toBeDefined();
  });

  it('returns error when name is missing', () => {
    expect(
      normalizeScoringCriteriaPayload([{ name: '', maxScore: 100, sortOrder: 0 }]).error,
    ).toBeDefined();
  });

  it('returns error when maxScore is out of range', () => {
    expect(
      normalizeScoringCriteriaPayload([{ name: 'X', maxScore: -1, sortOrder: 0 }]).error,
    ).toBeDefined();
    expect(
      normalizeScoringCriteriaPayload([{ name: 'X', maxScore: 101, sortOrder: 0 }]).error,
    ).toBeDefined();
    expect(
      normalizeScoringCriteriaPayload([{ name: 'X', maxScore: 1.5, sortOrder: 0 }]).error,
    ).toBeDefined();
  });

  it('returns error when total != 100', () => {
    expect(
      normalizeScoringCriteriaPayload([
        { name: 'A', maxScore: 40, sortOrder: 0 },
        { name: 'B', maxScore: 40, sortOrder: 1 },
      ]).error,
    ).toBeDefined();
  });

  it('accepts a valid criteria set summing to 100', () => {
    const result = normalizeScoringCriteriaPayload([
      { name: 'Innovation', maxScore: 60 },
      { name: 'Execution', maxScore: 40, sortOrder: 1 },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.criteria).toEqual([
      { name: 'Innovation', maxScore: 60, sortOrder: 0 },
      { name: 'Execution', maxScore: 40, sortOrder: 1 },
    ]);
  });

  it('assigns sortOrder from index when omitted', () => {
    const result = normalizeScoringCriteriaPayload([
      { name: 'A', maxScore: 50 },
      { name: 'B', maxScore: 50 },
    ]);
    expect(result.criteria?.map((c) => c.sortOrder)).toEqual([0, 1]);
  });

  it('allows empty criteria set (no totals to enforce)', () => {
    const result = normalizeScoringCriteriaPayload([]);
    expect(result.error).toBeUndefined();
    expect(result.criteria).toEqual([]);
  });
});

describe('normalizeAdminBasePath', () => {
  it('defaults to /admin for empty/missing values', () => {
    expect(normalizeAdminBasePath(undefined)).toBe('/admin');
    expect(normalizeAdminBasePath('')).toBe('/admin');
    expect(normalizeAdminBasePath('   ')).toBe('/admin');
  });

  it('ensures a leading slash and collapses duplicates', () => {
    expect(normalizeAdminBasePath('admin')).toBe('/admin');
    expect(normalizeAdminBasePath('ops//panel')).toBe('/ops/panel');
  });

  it('strips trailing slashes except for root', () => {
    expect(normalizeAdminBasePath('/admin/')).toBe('/admin');
    expect(normalizeAdminBasePath('/')).toBe('/admin');
  });
});

describe('input length limits', () => {
  it('exposes sensible defaults', () => {
    expect(MAX_TITLE_LENGTH).toBeGreaterThan(0);
    expect(MAX_DESCRIPTION_LENGTH).toBeGreaterThan(MAX_TITLE_LENGTH);
    expect(MAX_EMAIL_LENGTH).toBe(254);
    expect(MAX_URL_LENGTH).toBeGreaterThan(0);
    expect(MAX_SEARCH_LENGTH).toBeGreaterThan(0);
    expect(MAX_TAG_LENGTH).toBeGreaterThan(0);
    expect(MAX_TAGS_COUNT).toBeGreaterThan(0);
  });
});

describe('truncateString', () => {
  it('returns undefined for null/undefined input', () => {
    expect(truncateString(undefined, 10)).toBeUndefined();
    expect(truncateString(null, 10)).toBeUndefined();
  });

  it('truncates only when input exceeds the limit', () => {
    expect(truncateString('short', 10)).toBe('short');
    expect(truncateString('abcdefghij', 5)).toBe('abcde');
  });
});

describe('validateSearchInput', () => {
  it('returns null for empty or whitespace', () => {
    expect(validateSearchInput(undefined)).toBeNull();
    expect(validateSearchInput(null)).toBeNull();
    expect(validateSearchInput('')).toBeNull();
    expect(validateSearchInput('   ')).toBeNull();
  });

  it('trims and shortens inputs that exceed the search limit', () => {
    const long = 'a'.repeat(MAX_SEARCH_LENGTH + 50);
    const result = validateSearchInput(long);
    expect(result?.length).toBe(MAX_SEARCH_LENGTH);
  });

  it('returns the trimmed string when within bounds', () => {
    expect(validateSearchInput('  hello  ')).toBe('hello');
  });
});
