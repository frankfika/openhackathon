import { Prisma } from '@prisma/client';
import type { SiteSetting } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  HACKATHON_STATUS_PRIORITY,
  DEFAULT_HACKATHON_COVER_GRADIENT,
  SINGLE_HACKATHON_MODE,
  DEFAULT_LEGACY_SESSION_NAME,
  DEFAULT_LEGACY_SESSION_TYPE,
  asString,
} from '../config';
import type {
  PrismaLikeClient,
  HackathonWithRelations,
  LegacyIdRow,
  LegacyBooleanRow,
  LegacyProjectRow,
  LegacyHackathonRow,
  ProjectSubmissionFilters,
} from '../types';

export function compareHackathonsByPriority(a: HackathonWithRelations, b: HackathonWithRelations): number {
  const aPriority = HACKATHON_STATUS_PRIORITY[a.status] ?? Number.MAX_SAFE_INTEGER;
  const bPriority = HACKATHON_STATUS_PRIORITY[b.status] ?? Number.MAX_SAFE_INTEGER;
  if (aPriority !== bPriority) return aPriority - bPriority;

  const byStartDate = b.startAt.getTime() - a.startAt.getTime();
  if (byStartDate !== 0) return byStartDate;

  return a.id.localeCompare(b.id);
}

export async function listHackathonsWithRelations(client: PrismaLikeClient): Promise<HackathonWithRelations[]> {
  const hackathons = await client.hackathon.findMany({
    include: { scoringCriteria: true },
  });
  return hackathons.sort(compareHackathonsByPriority);
}

export async function getCurrentHackathon(client: PrismaLikeClient): Promise<HackathonWithRelations | null> {
  const hackathons = await listHackathonsWithRelations(client);
  return hackathons[0] || null;
}

export async function getScopedHackathonId(client: PrismaLikeClient, input: unknown): Promise<string | undefined> {
  const requested = asString(input);
  if (requested) return requested;
  if (!SINGLE_HACKATHON_MODE) return undefined;

  const current = await getCurrentHackathon(client);
  return current?.id;
}

export function resolveHackathonCoverGradient(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_HACKATHON_COVER_GRADIENT;
  const normalized = value.trim();
  return normalized || DEFAULT_HACKATHON_COVER_GRADIENT;
}

export function parseProjectSubmissionFilters(value: unknown): ProjectSubmissionFilters | null {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const filters: ProjectSubmissionFilters = {};
    for (const [fieldId, fieldValue] of Object.entries(parsed)) {
      const normalizedFieldId = fieldId.trim();
      const normalizedFieldValue = typeof fieldValue === 'string' ? fieldValue.trim() : '';
      if (!normalizedFieldId || !normalizedFieldValue) continue;
      filters[normalizedFieldId] = normalizedFieldValue;
    }
    return filters;
  } catch {
    return null;
  }
}

export function buildProjectSubmissionFilterClause(fieldId: string, value: string): Prisma.ProjectWhereInput {
  switch (fieldId) {
    case 'title':
      return { title: value };
    case 'oneLiner':
      return { oneLiner: value };
    case 'description':
      return { description: value };
    case 'demoUrl':
      return { demoUrl: value };
    case 'repoUrl':
      return { repoUrl: value };
    case 'submitterEmail':
      return { submitterEmail: value };
    case 'submitterName':
      return { submitterName: value };
    case 'status':
      return { status: value };
    default:
      return {
        submissionData: {
          path: [fieldId],
          equals: value,
        },
      };
  }
}

export async function supportsSessionScopedAssignments(client: PrismaLikeClient): Promise<boolean> {
  const rows = await client.$queryRaw<LegacyBooleanRow[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Assignment'
        AND column_name = 'sessionId'
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
}

export async function loadProjectsWithSession(client: PrismaLikeClient, projectIds: string[]): Promise<LegacyProjectRow[]> {
  if (projectIds.length === 0) return [];

  return client.$queryRaw<LegacyProjectRow[]>(Prisma.sql`
    SELECT "id", "hackathonId", "title", "sessionId"
    FROM "Project"
    WHERE "id" IN (${Prisma.join(projectIds)})
  `);
}

export async function ensureLegacyHackathonSessionId(
  client: PrismaLikeClient,
  hackathon: LegacyHackathonRow,
): Promise<string> {
  const existing = await client.$queryRaw<LegacyIdRow[]>(Prisma.sql`
    SELECT "id"
    FROM "Session"
    WHERE "hackathonId" = ${hackathon.id}
    ORDER BY "startAt" ASC, "createdAt" ASC, "id" ASC
    LIMIT 1
  `);

  const existingId = existing[0]?.id;
  if (existingId) return existingId;

  const now = new Date();
  const created = await client.$queryRaw<LegacyIdRow[]>(Prisma.sql`
    INSERT INTO "Session" (
      "id",
      "hackathonId",
      "name",
      "type",
      "status",
      "startAt",
      "endAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${hackathon.id},
      ${DEFAULT_LEGACY_SESSION_NAME},
      ${DEFAULT_LEGACY_SESSION_TYPE},
      ${hackathon.status},
      ${hackathon.startAt},
      ${hackathon.endAt},
      ${now},
      ${now}
    )
    RETURNING "id"
  `);

  return created[0]!.id;
}

export function serializeSiteSettings(settings: SiteSetting) {
  const { smtpPassEncrypted, ...rest } = settings;
  return {
    ...rest,
    smtpPasswordConfigured: Boolean(smtpPassEncrypted),
  };
}

export function serializePublicSiteSettings(settings: SiteSetting) {
  return {
    id: settings.id,
    key: settings.key,
    siteName: settings.siteName,
    adminBasePath: settings.adminBasePath,
    logoUrl: settings.logoUrl,
    tabTitle: settings.tabTitle,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
    faviconUrl: settings.faviconUrl,
    showPoweredBy: settings.showPoweredBy,
    poweredByText: settings.poweredByText,
    poweredByUrl: settings.poweredByUrl,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}
