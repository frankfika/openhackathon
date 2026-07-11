import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { VALID_ASSIGNMENT_STATUSES, asString } from '../config';
import type { LegacyIdRow } from '../types';
import { getErrorMessage, dedupeIds } from '../utils/validation';
import { getScopedHackathonId, supportsSessionScopedAssignments, loadProjectsWithSession, ensureLegacyHackathonSessionId } from '../utils/hackathon';
import { logActivity, getActorInfo } from '../utils/activity';

export function registerAssignmentRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAuth, requireAdmin }: { requireAuth: RequestHandler; requireAdmin: RequestHandler },
) {
  // GET /api/assignments - list assignments with optional filters
  app.get('/api/assignments', requireAuth, async (req, res) => {
    const { projectId, judgeId, status, hackathonId, lite } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);
    const viewer = req.authUser!;
    const effectiveJudgeId = viewer.role === 'judge' ? viewer.id : (judgeId ? String(judgeId) : undefined);
    const assignments = await prisma.assignment.findMany({
      where: {
        ...(projectId ? { projectId: String(projectId) } : {}),
        ...(effectiveJudgeId ? { judgeId: effectiveJudgeId } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {}),
      },
      include: lite ? undefined : {
        project: true,
        judge: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
        scores: true,
      }
    });
    res.json(assignments);
  });

  // GET /api/assignments/:id - get single assignment
  app.get('/api/assignments/:id', requireAuth, async (req, res) => {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        judge: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
        scores: true,
      },
    });
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(assignment);
  });

  // PUT /api/assignments/:id/status - update assignment status (judge only)
  app.put('/api/assignments/:id/status', requireAuth, async (req, res) => {
    const { status } = req.body;

    if (!status || !VALID_ASSIGNMENT_STATUSES.has(String(status))) {
      return res.status(400).json({ error: 'Invalid assignment status' });
    }

    const existing = await prisma.assignment.findUnique({
      where: { id: req.params.id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const viewer = req.authUser!;
    if (viewer.role !== 'judge' || existing.judgeId !== viewer.id) {
      return res.status(403).json({ error: 'Only the assigned judge can update assignment status' });
    }

    const updated = await prisma.assignment.update({
      where: { id: req.params.id },
      data: { status: String(status) },
      include: {
        project: true,
        judge: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
        scores: true,
      }
    });

    res.json(updated);
  });

  // POST /api/assignments - bulk create assignments with session-scoped logic
  app.post('/api/assignments', requireAdmin, async (req, res) => {
    const { assignments } = req.body; // Array of { projectId, judgeId }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'Assignments payload must be a non-empty array' });
    }

    try {
      // Parse and validate input shape first (no DB calls)
      const parsed: { judgeId: string; projectId: string }[] = [];
      for (const rawAssignment of assignments) {
        const judgeId = asString(rawAssignment?.judgeId);
        const projectId = asString(rawAssignment?.projectId);
        if (!judgeId) throw new Error('Each assignment must contain judgeId');
        if (!projectId) throw new Error('Each assignment must contain projectId');
        parsed.push({ judgeId, projectId });
      }

      const uniqueJudgeIds = dedupeIds(parsed.map((a) => a.judgeId));
      const uniqueProjectIds = dedupeIds(parsed.map((a) => a.projectId));

      const created = await prisma.$transaction(async (tx) => {
        const useSessionScopedAssignments = await supportsSessionScopedAssignments(tx);

        // Batch-validate judges and projects in two queries instead of N*3
        const [judges, projects] = await Promise.all([
          tx.user.findMany({
            where: { id: { in: uniqueJudgeIds }, role: 'judge' },
            select: { id: true, name: true },
          }),
          useSessionScopedAssignments
            ? loadProjectsWithSession(tx, uniqueProjectIds)
            : tx.project.findMany({
                where: { id: { in: uniqueProjectIds } },
                select: { id: true, hackathonId: true, title: true },
              }).then((rows) => rows.map((row) => ({ ...row, sessionId: null }))),
        ]);

        const judgeMap = new Map(judges.map((j) => [j.id, j]));
        const projectMap = new Map(projects.map((p) => [p.id, p]));

        for (const judgeId of uniqueJudgeIds) {
          if (!judgeMap.has(judgeId)) throw new Error(`Judge ${judgeId} not found`);
        }
        for (const projectId of uniqueProjectIds) {
          if (!projectMap.has(projectId)) throw new Error(`Project ${projectId} not found`);
        }

        // Batch-validate hackathon memberships
        const membershipKeys = new Set<string>();
        for (const { judgeId, projectId } of parsed) {
          const project = projectMap.get(projectId)!;
          membershipKeys.add(`${project.hackathonId}:${judgeId}`);
        }
        const hackathonIds = dedupeIds(projects.map((p) => p.hackathonId));
        const memberships = await tx.hackathonJudge.findMany({
          where: {
            hackathonId: { in: hackathonIds },
            userId: { in: uniqueJudgeIds },
          },
          select: { hackathonId: true, userId: true },
        });
        const membershipSet = new Set(memberships.map((m) => `${m.hackathonId}:${m.userId}`));

        for (const key of membershipKeys) {
          if (!membershipSet.has(key)) {
            const [, judgeId] = key.split(':');
            throw new Error(`Judge ${judgeId} is not registered for this hackathon`);
          }
        }

        // Upsert assignments (still sequential due to unique constraint handling)
        if (!useSessionScopedAssignments) {
          const rows = [];
          for (const { judgeId, projectId } of parsed) {
            const assignment = await tx.assignment.upsert({
              where: { projectId_judgeId: { projectId, judgeId } },
              update: {},
              create: { projectId, judgeId, status: 'pending' },
              include: { project: true, judge: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true } }, scores: true },
            });
            rows.push(assignment);
          }

          return rows;
        }

        const hackathons = await tx.hackathon.findMany({
          where: { id: { in: hackathonIds } },
          select: { id: true, title: true, status: true, startAt: true, endAt: true },
        });
        const hackathonMap = new Map(hackathons.map((hackathon) => [hackathon.id, hackathon]));

        const sessionIdByHackathon = new Map<string, string>();
        const assignmentIds: string[] = [];
        for (const { judgeId, projectId } of parsed) {
          const project = projectMap.get(projectId)!;
          let sessionId = project.sessionId;

          if (!sessionId) {
            if (!sessionIdByHackathon.has(project.hackathonId)) {
              const hackathon = hackathonMap.get(project.hackathonId);
              if (!hackathon) {
                throw new Error(`Hackathon ${project.hackathonId} not found for project ${projectId}`);
              }
              sessionIdByHackathon.set(
                project.hackathonId,
                await ensureLegacyHackathonSessionId(tx, hackathon),
              );
            }

            sessionId = sessionIdByHackathon.get(project.hackathonId)!;
            await tx.$executeRaw(Prisma.sql`
              UPDATE "Project"
              SET "sessionId" = ${sessionId}, "updatedAt" = NOW()
              WHERE "id" = ${projectId} AND "sessionId" IS NULL
            `);
            project.sessionId = sessionId;
          }

          const rows = await tx.$queryRaw<LegacyIdRow[]>(Prisma.sql`
            WITH inserted AS (
              INSERT INTO "Assignment" (
                "id",
                "sessionId",
                "projectId",
                "judgeId",
                "status",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ${randomUUID()},
                ${sessionId},
                ${projectId},
                ${judgeId},
                'pending',
                NOW(),
                NOW()
              )
              ON CONFLICT ("sessionId", "projectId", "judgeId") DO NOTHING
              RETURNING "id"
            )
            SELECT "id" FROM inserted
            UNION ALL
            SELECT "id"
            FROM "Assignment"
            WHERE "sessionId" = ${sessionId}
              AND "projectId" = ${projectId}
              AND "judgeId" = ${judgeId}
            LIMIT 1
          `);

          const assignmentId = rows[0]?.id;
          if (!assignmentId) {
            throw new Error(`Failed to upsert assignment for project ${projectId} and judge ${judgeId}`);
          }
          assignmentIds.push(assignmentId);
        }

        const createdAssignments = await tx.assignment.findMany({
          where: { id: { in: assignmentIds } },
          include: { project: true, judge: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true } }, scores: true },
        });
        const assignmentMap = new Map(createdAssignments.map((assignment) => [assignment.id, assignment]));

        return assignmentIds
          .map((assignmentId) => assignmentMap.get(assignmentId))
          .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment));
      });

      // Log assignment creation
      const actor = getActorInfo(req);
      for (const assignment of created) {
        await logActivity(prisma, {
          hackathonId: assignment.project.hackathonId,
          actorId: actor?.actorId,
          actorRole: actor?.actorRole ?? 'system',
          actorName: actor?.actorName ?? 'System',
          action: 'assign',
          entityType: 'assignment',
          entityId: assignment.id,
          metadata: {
            projectId: assignment.projectId,
            projectTitle: assignment.project.title,
            judgeId: assignment.judgeId,
            judgeName: assignment.judge.name,
          },
          ipAddress: req.ip,
        });
      }

      res.json(created);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error, 'Failed to create assignments') });
    }
  });

  // DELETE /api/assignments/bulk - bulk-delete pending assignments for a hackathon
  app.delete('/api/assignments/bulk', requireAdmin, async (req, res) => {
    try {
      const { hackathonId } = req.body;
      if (!hackathonId) {
        return res.status(400).json({ error: 'hackathonId is required' });
      }

      const result = await prisma.assignment.deleteMany({
        where: {
          status: 'pending',
          project: { hackathonId },
        },
      });

      const actor = getActorInfo(req);
      await logActivity(prisma, {
        hackathonId,
        actorId: actor?.actorId,
        actorRole: actor?.actorRole ?? 'system',
        actorName: actor?.actorName ?? 'System',
        action: 'bulk_reset',
        entityType: 'assignment',
        entityId: hackathonId,
        metadata: { deleted: result.count },
        ipAddress: req.ip,
      });

      res.json({ deleted: result.count });
    } catch {
      res.status(500).json({ error: 'Failed to reset assignments' });
    }
  });

  // DELETE /api/assignments/:id - delete single assignment (with force option for scored)
  app.delete('/api/assignments/:id', requireAdmin, async (req, res) => {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        include: { scores: { select: { id: true }, take: 1 }, project: true, judge: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true } } },
      });
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      const hasScores = assignment.status === 'completed' || assignment.scores.length > 0;
      if (hasScores && req.query.force !== 'true') {
        return res.status(409).json({
          error: 'Assignment already scored',
          code: 'ALREADY_SCORED',
        });
      }

      await prisma.assignment.delete({
        where: { id: req.params.id }
      });

      // Log assignment deletion
      const actor = getActorInfo(req);
      await logActivity(prisma, {
        hackathonId: assignment.project.hackathonId,
        actorId: actor?.actorId,
        actorRole: actor?.actorRole ?? 'system',
        actorName: actor?.actorName ?? 'System',
        action: 'unassign',
        entityType: 'assignment',
        entityId: req.params.id,
        metadata: {
          projectId: assignment.projectId,
          projectTitle: assignment.project.title,
          judgeId: assignment.judgeId,
          judgeName: assignment.judge.name,
        },
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  });
}
