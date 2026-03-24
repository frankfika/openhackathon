import type { Prisma, PrismaClient } from '@prisma/client';

export type UserRole = 'admin' | 'judge';

export type AuthUser = {
  id: string;
  role: UserRole;
  email: string;
  name: string;
};

export type JwtPayload = {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
};

export type SubmissionReceiptEmailPayload = {
  to: string;
  receiptId: string;
  hackathonTitle: string;
  projectTitle: string;
  issuedAtIso: string;
};

export type SubmissionReceiptEmailResult = {
  sent: boolean;
  reason?: 'disabled' | 'missing_config' | 'send_failed';
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type SendSubmissionReceiptEmailOptions = {
  ignoreEnabled?: boolean;
};

export type ResolvedSubmissionEmailConfig = {
  enabled: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
  subjectTemplate: string;
  timeoutMs: number;
};

export type ScoringCriterionPayload = {
  name: string;
  maxScore: number;
  sortOrder?: number;
};

export type AssignmentScorePayload = {
  criterionId: string;
  score: number;
};

export type DashboardStats = {
  totalProjects?: number;
  totalJudges?: number;
  totalAssignments?: number;
  completedAssignments?: number;
  pendingReviews?: number;
  completed?: number;
  pending?: number;
};

export type ProjectSubmissionFilters = Record<string, string>;

export type ActivityAction =
  | 'create' | 'update' | 'delete'
  | 'submit' | 'assign' | 'unassign'
  | 'score' | 'update_score' | 'complete_review'
  | 'login' | 'logout' | 'invite'
  | 'bulk_reset';

export type ActivityEntityType =
  | 'project' | 'assignment' | 'score' | 'hackathon'
  | 'judge' | 'user' | 'session' | 'setting';

export type ActivityLogInput = {
  hackathonId?: string;
  actorId?: string;
  actorRole: 'admin' | 'judge' | 'user' | 'system';
  actorName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
};

export type PrismaLikeClient = PrismaClient | Prisma.TransactionClient;

export type HackathonWithRelations = Prisma.HackathonGetPayload<{
  include: { scoringCriteria: true }
}>;

export type LegacyIdRow = { id: string };
export type LegacyBooleanRow = { exists: boolean };
export type LegacyProjectRow = {
  id: string;
  hackathonId: string;
  title: string;
  sessionId: string | null;
};
export type LegacyHackathonRow = {
  id: string;
  title: string;
  status: string;
  startAt: Date;
  endAt: Date;
};

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}
