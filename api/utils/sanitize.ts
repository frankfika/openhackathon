/**
 * User sanitization — single source of truth for which User fields are
 * safe to expose through the public / authenticated API surface.
 *
 * Design rules (see synth-design-spec §1.1, §1.2 P0-1):
 *  1. All `findUnique` / `findMany` that may be returned to the client MUST
 *     pass `select: USER_PUBLIC_FIELDS` (or a narrower subset). Never
 *     `include: { user: true }` or any other relation pull that yields
 *     the `password` column.
 *  2. The `password` field is intentionally absent from BOTH whitelists
 *     below. It must never appear on the wire, in logs, or in error
 *     payloads.
 *  3. `sanitizeUser` is a defense-in-depth helper that strips any
 *     sensitive column from a user object that somehow already has
 *     them — it is belt-and-braces, NOT a substitute for `select`.
 */
import type { Prisma } from '@prisma/client';

/** Fields safe to expose on any authenticated or public endpoint. */
export const USER_PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  createdAt: true,
} as const;

/** Sensitive columns that MUST never be returned to clients. */
export const USER_SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'wallets',
  'globalPoints',
  'participationCount',
  'judgeCount',
  'awardCount',
  'primaryWalletId',
  'isWeb3User',
  'updatedAt',
] as const;

/** A narrower whitelist for the project submitter (public, anonymous). */
export const PROJECT_SUBMITTER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  avatarUrl: true,
} as const satisfies Pick<Prisma.UserSelect, 'id' | 'name' | 'avatarUrl'>;

export type UserPublicView = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC_FIELDS }>;
export type ProjectSubmitterView = Prisma.UserGetPayload<{
  select: typeof PROJECT_SUBMITTER_PUBLIC_FIELDS;
}>;

/** Build a Prisma select literal that is the public-fields object. */
export const userPublicSelect = USER_PUBLIC_FIELDS;

/** Build a Prisma select literal that is the submitter-fields object. */
export const projectSubmitterSelect = PROJECT_SUBMITTER_PUBLIC_FIELDS;

/**
 * Defense-in-depth: strip sensitive columns from an arbitrary user-shaped
 * value before serializing. This is a no-op for objects produced by
 * `select: USER_PUBLIC_FIELDS` but guards against future code paths that
 * accidentally pull the full row.
 */
export function sanitizeUser<T extends Record<string, unknown>>(user: T | null | undefined): T {
  if (!user || typeof user !== 'object') return user as T;
  const copy = { ...user } as Record<string, unknown>;
  for (const key of USER_SENSITIVE_FIELDS) {
    if (key in copy) {
      delete copy[key];
    }
  }
  return copy as T;
}

/** True if the given field name is considered sensitive. */
export function isSensitiveUserField(field: string): boolean {
  return (USER_SENSITIVE_FIELDS as readonly string[]).includes(field);
}
