import { describe, expect, it } from 'vitest';
import {
  compareHackathonsByPriority,
  resolveHackathonCoverGradient,
  parseProjectSubmissionFilters,
  buildProjectSubmissionFilterClause,
  serializeSiteSettings,
  serializePublicSiteSettings,
} from '../utils/hackathon';
import { HACKATHON_STATUS_PRIORITY } from '../config';
import type { HackathonWithRelations } from '../types';
import type { SiteSetting } from '@prisma/client';

function makeBaseHackathon(): HackathonWithRelations {
  return {
    id: 'h1',
    title: 'A',
    tagline: '',
    city: null,
    prizePool: null,
    coverGradient: '',
    status: 'upcoming',
    startAt: new Date('2026-01-01T00:00:00Z'),
    endAt: new Date('2026-01-02T00:00:00Z'),
    description: null,
    rules: null,
    judgingCriteria: null,
    prizes: null,
    schedule: null,
    sponsors: null,
    contactEmail: null,
    docsUrl: null,
    submissionSchema: {},
    submissionEmailEnabled: false,
    submissionSuccessHint: null,
    submissionSuccessHintText: null,
    submissionSuccessHintImageUrl: null,
    requireJudge: false,
    requireEmail: false,
    receiptPrefix: null,
    judgesPerProject: null,
    leaderboardData: null,
    leaderboardPublished: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    scoringCriteria: [],
  } as unknown as HackathonWithRelations;
}

const baseHackathon = makeBaseHackathon();

describe('compareHackathonsByPriority', () => {
  it('orders by status priority', () => {
    const a = { ...baseHackathon, status: 'active' as const };
    const b = { ...baseHackathon, status: 'upcoming' as const, id: 'h2' };
    expect(compareHackathonsByPriority(a, b)).toBeLessThan(0);
  });

  it('falls back to most-recent startAt within same status', () => {
    const a = { ...baseHackathon, status: 'upcoming' as const, startAt: new Date('2026-03-01') };
    const b = { ...baseHackathon, status: 'upcoming' as const, startAt: new Date('2026-02-01'), id: 'h2' };
    expect(compareHackathonsByPriority(a, b)).toBeLessThan(0);
  });

  it('falls back to id lex order when status and startAt match', () => {
    const a = { ...baseHackathon, id: 'a' };
    const b = { ...baseHackathon, id: 'b' };
    expect(compareHackathonsByPriority(a, b)).toBeLessThan(0);
  });

  it('exposes a sensible status priority ordering', () => {
    expect(HACKATHON_STATUS_PRIORITY.active).toBeLessThan(HACKATHON_STATUS_PRIORITY.upcoming);
    expect(HACKATHON_STATUS_PRIORITY.upcoming).toBeLessThan(HACKATHON_STATUS_PRIORITY.completed);
  });
});

describe('resolveHackathonCoverGradient', () => {
  it('returns fallback when not a string', () => {
    expect(resolveHackathonCoverGradient(undefined)).toMatch(/^from-/);
    expect(resolveHackathonCoverGradient(null)).toMatch(/^from-/);
    expect(resolveHackathonCoverGradient(123)).toMatch(/^from-/);
  });

  it('returns fallback for empty/whitespace strings', () => {
    expect(resolveHackathonCoverGradient('')).toMatch(/^from-/);
    expect(resolveHackathonCoverGradient('   ')).toMatch(/^from-/);
  });

  it('preserves valid gradient strings', () => {
    expect(resolveHackathonCoverGradient('from-pink-500 to-purple-500')).toBe('from-pink-500 to-purple-500');
  });
});

describe('parseProjectSubmissionFilters', () => {
  it('returns empty object for nullish / empty input', () => {
    expect(parseProjectSubmissionFilters(null)).toEqual({});
    expect(parseProjectSubmissionFilters(undefined)).toEqual({});
    expect(parseProjectSubmissionFilters('')).toEqual({});
  });

  it('returns null for non-string input', () => {
    expect(parseProjectSubmissionFilters(42)).toBeNull();
    expect(parseProjectSubmissionFilters({})).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseProjectSubmissionFilters('{not-json')).toBeNull();
  });

  it('returns null when payload is not an object', () => {
    expect(parseProjectSubmissionFilters(JSON.stringify([]))).toBeNull();
    expect(parseProjectSubmissionFilters(JSON.stringify('foo'))).toBeNull();
  });

  it('drops empty keys and values', () => {
    expect(parseProjectSubmissionFilters(JSON.stringify({ title: 'X', '': 'Y', z: '' }))).toEqual({
      title: 'X',
    });
  });

  it('trims keys and values', () => {
    expect(parseProjectSubmissionFilters(JSON.stringify({ '  k  ': '  v  ' }))).toEqual({ k: 'v' });
  });
});

describe('buildProjectSubmissionFilterClause', () => {
  it('maps known fields to where conditions', () => {
    expect(buildProjectSubmissionFilterClause('title', 'X')).toEqual({ title: 'X' });
    expect(buildProjectSubmissionFilterClause('submitterEmail', 'a@b.co')).toEqual({
      submitterEmail: 'a@b.co',
    });
    expect(buildProjectSubmissionFilterClause('status', 'submitted')).toEqual({ status: 'submitted' });
  });

  it('falls back to submissionData JSON path for unknown fields', () => {
    expect(buildProjectSubmissionFilterClause('customField', 'v')).toEqual({
      submissionData: { path: ['customField'], equals: 'v' },
    });
  });
});

describe('site settings serializers', () => {
  const baseSettings = {
    id: 's1',
    key: 'default',
    siteName: 'OpenHackathon',
    adminBasePath: '/admin',
    logoUrl: null,
    tabTitle: 'T',
    seoTitle: 'T',
    seoDescription: 'D',
    faviconUrl: null,
    showPoweredBy: true,
    poweredByText: 'p',
    poweredByUrl: null,
    smtpHost: null,
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: null,
    smtpPassEncrypted: 'v1:abcd',
    submissionEmailEnabled: false,
    submissionEmailFrom: 'a',
    submissionEmailReplyTo: null,
    submissionEmailSubject: 's',
    submissionEmailTimeoutMs: 10000,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies SiteSetting;

  it('serializeSiteSettings strips smtpPassEncrypted and adds boolean flag', () => {
    const out = serializeSiteSettings(baseSettings);
    expect(out).not.toHaveProperty('smtpPassEncrypted');
    expect(out.smtpPasswordConfigured).toBe(true);
  });

  it('serializePublicSiteSettings exposes only public-safe fields', () => {
    const out = serializePublicSiteSettings(baseSettings);
    expect(out).not.toHaveProperty('smtpHost');
    expect(out).not.toHaveProperty('smtpPassEncrypted');
    expect(out.siteName).toBe('OpenHackathon');
    expect(out.adminBasePath).toBe('/admin');
  });
});
