import { asString } from '../config';
import type { UserRole, ScoringCriterionPayload } from '../types';

export function normalizeEmail(value: unknown): string | undefined {
  const raw = asString(value);
  return raw ? raw.toLowerCase() : undefined;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidHttpOrRootRelativeUrl(url: string): boolean {
  if (isValidHttpUrl(url)) return true;
  return url.startsWith('/') && !url.startsWith('//');
}

export function isValidPassword(password: string): boolean {
  if (password.length < 8 || password.length > 72) return false;
  // Require at least one uppercase, one lowercase, and one digit
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return hasUppercase && hasLowercase && hasDigit;
}

export function asUserRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'judge' || value === 'user') return value;
  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function normalizeScoringCriteriaPayload(input: unknown[]): { criteria?: ScoringCriterionPayload[]; error?: string } {
  const criteria: ScoringCriterionPayload[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'scoringCriteria must be an array of objects' };
    }

    const name = asString((item as { name?: unknown }).name);
    const maxScoreValue = Number((item as { maxScore?: unknown }).maxScore);
    const sortOrderInput = (item as { sortOrder?: unknown }).sortOrder;
    const sortOrderValue = sortOrderInput === undefined ? index : Number(sortOrderInput);

    if (!name) {
      return { error: 'Each scoring criterion must include a name' };
    }
    if (!Number.isInteger(maxScoreValue) || maxScoreValue < 0 || maxScoreValue > 100) {
      return { error: 'Each scoring criterion maxScore must be an integer between 0 and 100' };
    }
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0) {
      return { error: 'Each scoring criterion sortOrder must be a non-negative integer' };
    }

    criteria.push({
      name,
      maxScore: maxScoreValue,
      sortOrder: sortOrderValue,
    });
  }

  if (criteria.length > 0) {
    const totalScore = criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
    if (totalScore !== 100) {
      return { error: 'Scoring criteria total maxScore must equal 100' };
    }
  }

  return { criteria };
}

export function normalizeAdminBasePath(value?: string | null) {
  const fallback = '/admin';
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return fallback;

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');
  const normalized = collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed;

  return normalized === '/' ? fallback : normalized;
}

// ===== Input length limits =====

export const MAX_TITLE_LENGTH = 200;
export const MAX_TAGLINE_LENGTH = 500;
export const MAX_DESCRIPTION_LENGTH = 10000;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_URL_LENGTH = 2000;
export const MAX_SEARCH_LENGTH = 200;
export const MAX_TAG_LENGTH = 50;
export const MAX_TAGS_COUNT = 20;
export const MAX_CITY_LENGTH = 100;
export const MAX_PRIZE_POOL_LENGTH = 200;

export function truncateString(value: string | undefined | null, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function validateSearchInput(search: string | undefined | null): string | null {
  if (search === undefined || search === null) return null;
  const trimmed = String(search).trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_SEARCH_LENGTH) {
    return trimmed.slice(0, MAX_SEARCH_LENGTH);
  }
  return trimmed;
}
