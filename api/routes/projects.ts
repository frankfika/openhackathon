import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { asString } from '../config';
import { normalizeEmail, isValidEmail, validateSearchInput, MAX_TITLE_LENGTH, MAX_TAG_LENGTH, MAX_TAGS_COUNT, MAX_DESCRIPTION_LENGTH } from '../utils/validation';
import { getScopedHackathonId, parseProjectSubmissionFilters, buildProjectSubmissionFilterClause } from '../utils/hackathon';
import { generateSubmissionReceiptId, sendSubmissionReceiptEmail } from '../utils/email';
import { logActivity } from '../utils/activity';
import { awardPoints, resolveSubmitterUserId } from '../services/points';
import { USER_PUBLIC_FIELDS, PROJECT_SUBMITTER_PUBLIC_FIELDS } from '../utils/sanitize';

export function registerProjectRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin, submissionRateLimiter, defaultSiteSettings }: { requireAdmin: RequestHandler; submissionRateLimiter: RequestHandler; defaultSiteSettings: Record<string, unknown> },
) {
  app.get('/api/projects', async (req, res) => {
    const { hackathonId, lite, page, pageSize, search, status, submissionFilters } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);

    const pageNum = page ? Math.max(1, parseInt(String(page), 10)) : null;
    const pageSizeNum = pageSize ? Math.min(200, Math.max(1, parseInt(String(pageSize), 10))) : null;
    const searchStr = validateSearchInput(search as string | undefined);
    const statusStr = typeof status === 'string' ? status.trim() : '';
    const statusValue = statusStr ? statusStr : null;
    const parsedSubmissionFilters = parseProjectSubmissionFilters(submissionFilters);

    if (statusValue && statusValue !== 'draft' && statusValue !== 'submitted') {
      return res.status(400).json({ error: 'Invalid project status' });
    }
    if (parsedSubmissionFilters === null) {
      return res.status(400).json({ error: 'Invalid submissionFilters' });
    }

    const submissionFilterClauses = Object.entries(parsedSubmissionFilters).map(([fieldId, value]) =>
      buildProjectSubmissionFilterClause(fieldId, value)
    );

    const where: Prisma.ProjectWhereInput = {
      ...(hackathonIdValue ? { hackathonId: hackathonIdValue } : {}),
      ...(statusValue ? { status: statusValue } : {}),
      ...(searchStr ? {
        OR: [
          { title: { contains: searchStr, mode: 'insensitive' as const } },
          { oneLiner: { contains: searchStr, mode: 'insensitive' as const } },
          { submitterName: { contains: searchStr, mode: 'insensitive' as const } },
          { submitterEmail: { contains: searchStr, mode: 'insensitive' as const } },
          { tags: { has: searchStr } },
        ],
      } : {}),
      ...(submissionFilterClauses.length > 0 ? { AND: submissionFilterClauses } : {}),
    };

    // Paginated response
    if (pageNum !== null && pageSizeNum !== null) {
      const [total, projects] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          skip: (pageNum - 1) * pageSizeNum,
          take: pageSizeNum,
          orderBy: { createdAt: 'desc' },
          include: {
            // Don't include `user: true` — that returns the password hash.
            user: { select: USER_PUBLIC_FIELDS },
            assignments: {
              select: {
                id: true,
                projectId: true,
                judgeId: true,
                status: true,
                totalScore: true,
                judge: { select: { id: true, name: true } },
              }
            },
          },
        }),
      ]);
      return res.json({ data: projects, total, page: pageNum, pageSize: pageSizeNum });
    }

    // Legacy: return plain array (used by AssignmentManager lite=true, leaderboard picker, etc.)
    const projects = await prisma.project.findMany({
      where,
      include: lite ? undefined : {
        // Don't include `user: true` — that returns the password hash.
        user: { select: USER_PUBLIC_FIELDS },
        assignments: {
          select: {
            id: true,
            projectId: true,
            judgeId: true,
            status: true,
            totalScore: true,
            judge: { select: { id: true, name: true } },
          }
        },
      }
    });
    res.json(projects);
  });

  app.get('/api/projects/:id', async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          // Public endpoint — never expose email/role/createdAt to anonymous
          // visitors. The full USER_PUBLIC_FIELDS is reserved for
          // authenticated admin/judge callers.
          select: PROJECT_SUBMITTER_PUBLIC_FIELDS,
        },
        assignments: {
          // Do NOT include `judge: true` here — this endpoint is public (no auth
          // guard above) and `judge: true` would leak every assigned judge's
          // password hash to anyone who knows or guesses a project id.
          include: { judge: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true } }, scores: true }
        },
        hackathon: { include: { scoringCriteria: true } },
      }
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  });

  app.post('/api/projects', submissionRateLimiter, async (req, res) => {
    const { hackathonId, title, oneLiner, description, tags, demoUrl, repoUrl, submitterEmail, submitterName, submissionData } = req.body;

    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);
    const titleValue = asString(title);
    const submitterEmailValue = normalizeEmail(submitterEmail);
    const submitterNameValue = asString(submitterName);

    if (titleValue && titleValue.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` });
    }
    if (description && typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
      return res.status(400).json({ error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
    }

    if (!hackathonIdValue) {
      return res.status(400).json({ error: 'hackathonId is required' });
    }

    if (!titleValue) {
      return res.status(400).json({ error: 'title is required' });
    }

    if (!submitterEmailValue) {
      return res.status(400).json({ error: 'submitterEmail is required' });
    }

    if (!isValidEmail(submitterEmailValue)) {
      return res.status(400).json({ error: 'submitterEmail must be a valid email' });
    }

    const relatedHackathon = await prisma.hackathon.findUnique({
      where: { id: hackathonIdValue },
    });

    if (!relatedHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const receipt = {
      id: generateSubmissionReceiptId(),
      email: submitterEmailValue,
      issuedAt: new Date().toISOString(),
    };

    const incomingSubmissionData =
      submissionData && typeof submissionData === 'object' && !Array.isArray(submissionData)
        ? (submissionData as Record<string, unknown>)
        : {};

    const oneLinerValue = asString(oneLiner) || 'Contact-only submission';
    const descriptionValue = asString(description);
    const demoUrlValue = asString(demoUrl);
    const repoUrlValue = asString(repoUrl);
    const tagsValue = Array.isArray(tags)
      ? tags.filter((tag: unknown): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, MAX_TAGS_COUNT)
      : [];
    for (const tag of tagsValue) {
      if (tag.length > MAX_TAG_LENGTH) {
        return res.status(400).json({ error: `Each tag must be at most ${MAX_TAG_LENGTH} characters` });
      }
    }

    const project = await prisma.project.create({
      data: {
        hackathonId: hackathonIdValue,
        title: titleValue,
        oneLiner: oneLinerValue,
        description: descriptionValue,
        tags: tagsValue,
        demoUrl: demoUrlValue,
        repoUrl: repoUrlValue,
        submitterEmail: submitterEmailValue,
        submitterName: submitterNameValue,
        status: 'submitted',
        submissionData: ({
          ...incomingSubmissionData,
          _receipt: receipt,
        } as Prisma.InputJsonValue),
      },
      include: {
        hackathon: { include: { scoringCriteria: true } },
      }
    });

    const emailResult = await sendSubmissionReceiptEmail(prisma, defaultSiteSettings, {
      to: submitterEmailValue,
      receiptId: receipt.id,
      hackathonTitle: relatedHackathon.title,
      projectTitle: titleValue,
      issuedAtIso: receipt.issuedAt,
    });

    const receiptWithDelivery = {
      ...receipt,
      emailSent: emailResult.sent,
      emailMessageId: emailResult.messageId,
      emailFailureReason: emailResult.reason,
      emailLastAttemptAt: new Date().toISOString(),
    };

    let projectWithReceipt = project;
    try {
      projectWithReceipt = await prisma.project.update({
        where: { id: project.id },
        data: {
          submissionData: ({
            ...incomingSubmissionData,
            _receipt: receiptWithDelivery,
          } as Prisma.InputJsonValue),
        },
        include: {
          hackathon: { include: { scoringCriteria: true } },
        },
      });
    } catch (error) {
      console.error('[submission-email] Failed to persist receipt delivery status:', error);
    }

    // Log project submission
    await logActivity(prisma, {
      hackathonId: hackathonIdValue,
      actorRole: 'user',
      actorName: submitterNameValue || submitterEmailValue,
      action: 'submit',
      entityType: 'project',
      entityId: project.id,
      metadata: {
        title: titleValue,
        submitterEmail: submitterEmailValue,
        receiptId: receipt.id,
      },
      ipAddress: req.ip,
    });

    // Award cross-hackathon "participated" points if the submitter is a Web3 user.
    // Matches by linked email; no-op for non-Web3 submitters and idempotent.
    try {
      const submitterUserId = await resolveSubmitterUserId(prisma, {
        submitterEmail: submitterEmailValue,
      });
      if (submitterUserId) {
        await awardPoints(prisma, {
          userId: submitterUserId,
          hackathonId: hackathonIdValue,
          activityType: 'participated',
          metadata: { projectId: project.id, projectTitle: titleValue },
        });
      }
    } catch (error) {
      console.error('Failed to award participation points:', error);
    }

    res.json({
      ...projectWithReceipt,
      receipt: receiptWithDelivery,
    });
  });

  app.put('/api/projects/:id', requireAdmin, async (req, res) => {
    try {
      const { title, oneLiner, description, tags, demoUrl, repoUrl, submissionData, status } = req.body;
      const titleValue = title !== undefined ? asString(title) : undefined;
      if (title !== undefined && !titleValue) {
        return res.status(400).json({ error: 'title is required' });
      }
      const existingProject = await prisma.project.findUnique({
        where: { id: req.params.id },
        select: { submissionData: true },
      });
      const existingSubmissionData =
        existingProject?.submissionData &&
        typeof existingProject.submissionData === 'object' &&
        !Array.isArray(existingProject.submissionData)
          ? (existingProject.submissionData as Record<string, unknown>)
          : {};
      const existingReceipt =
        existingSubmissionData._receipt &&
        typeof existingSubmissionData._receipt === 'object' &&
        !Array.isArray(existingSubmissionData._receipt)
          ? (existingSubmissionData._receipt as Record<string, unknown>)
          : undefined;
      const incomingSubmissionData =
        submissionData && typeof submissionData === 'object' && !Array.isArray(submissionData)
          ? (submissionData as Record<string, unknown>)
          : {};

      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          title: titleValue,
          oneLiner,
          description,
          tags: tags || [],
          demoUrl,
          repoUrl,
          submissionData: ({
            ...incomingSubmissionData,
            ...(existingReceipt ? { _receipt: existingReceipt } : {}),
          } as Prisma.InputJsonValue),
          status,
        }
      });

      res.json(project);
    } catch {
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/projects/:id', requireAdmin, async (req, res) => {
    try {
      const projectId = req.params.id;
      // Delete assignments first
      await prisma.assignment.deleteMany({
        where: { projectId }
      });

      await prisma.project.delete({
        where: { id: projectId }
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.post('/api/projects/:id/receipt/resend', requireAdmin, async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        hackathon: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingSubmissionData =
      project.submissionData &&
      typeof project.submissionData === 'object' &&
      !Array.isArray(project.submissionData)
        ? (project.submissionData as Record<string, unknown>)
        : {};
    const existingReceipt =
      existingSubmissionData._receipt &&
      typeof existingSubmissionData._receipt === 'object' &&
      !Array.isArray(existingSubmissionData._receipt)
        ? (existingSubmissionData._receipt as Record<string, unknown>)
        : {};

    const receiptId = asString(existingReceipt.id) || generateSubmissionReceiptId();
    const receiptIssuedAt = asString(existingReceipt.issuedAt) || new Date().toISOString();
    const receiptEmail = project.submitterEmail;

    const emailResult = await sendSubmissionReceiptEmail(prisma, defaultSiteSettings, {
      to: receiptEmail,
      receiptId,
      hackathonTitle: project.hackathon.title,
      projectTitle: project.title,
      issuedAtIso: receiptIssuedAt,
    });

    const receipt = {
      id: receiptId,
      email: receiptEmail,
      issuedAt: receiptIssuedAt,
      emailSent: emailResult.sent,
      emailMessageId: emailResult.messageId,
      emailFailureReason: emailResult.reason,
      emailLastAttemptAt: new Date().toISOString(),
    };

    await prisma.project.update({
      where: { id: project.id },
      data: {
        submissionData: ({
          ...existingSubmissionData,
          _receipt: receipt,
        } as Prisma.InputJsonValue),
      },
    });

    res.json({
      projectId: project.id,
      receipt,
    });
  });
}
