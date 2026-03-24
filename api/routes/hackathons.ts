import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import { Prisma } from '@prisma/client';
import { SINGLE_HACKATHON_MODE, MARKDOWN_DOC_BODY_LIMIT, asString } from '../config';
import type { ScoringCriterionPayload } from '../types';
import { isValidHttpUrl, isValidHttpOrRootRelativeUrl, getErrorMessage, normalizeScoringCriteriaPayload } from '../utils/validation';
import { getCurrentHackathon, listHackathonsWithRelations, resolveHackathonCoverGradient } from '../utils/hackathon';
import { readHackathonMarkdownDoc, saveHackathonMarkdownDoc, deleteHackathonMarkdownDoc } from '../utils/documents';

export function registerHackathonRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
  const markdownDocJsonParser = express.json({ limit: MARKDOWN_DOC_BODY_LIMIT });

  // ===== Hackathons =====

  app.get('/api/hackathon', async (_req, res) => {
    const hackathon = await getCurrentHackathon(prisma);
    res.json(hackathon);
  });

  app.get('/api/hackathons', async (_req, res) => {
    const hackathons = await listHackathonsWithRelations(prisma);
    if (SINGLE_HACKATHON_MODE) {
      return res.json(hackathons.length > 0 ? [hackathons[0]] : []);
    }
    res.json(hackathons);
  });

  app.get('/api/hackathons/:id', async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      include: { scoringCriteria: true }
    });
    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }
    res.json(hackathon);
  });

  app.post('/api/hackathons', requireAdmin, async (req, res) => {
    const {
      title,
      tagline,
      city,
      startAt,
      endAt,
      status,
      coverGradient,
      submissionSchema,
      scoringCriteria,
      prizePool,
      docsUrl,
      submissionSuccessHintText,
      submissionSuccessHintImageUrl,
      judgesPerProject,
    } = req.body;
    const hasScoringCriteriaInput = Array.isArray(scoringCriteria);
    let scoringCriteriaInputs: ScoringCriterionPayload[] = [];
    if (hasScoringCriteriaInput) {
      const normalized = normalizeScoringCriteriaPayload(scoringCriteria as unknown[]);
      if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
      }
      scoringCriteriaInputs = normalized.criteria || [];
    }
    if (SINGLE_HACKATHON_MODE) {
      const existingHackathonCount = await prisma.hackathon.count();
      if (existingHackathonCount > 0) {
        return res.status(409).json({
          error: 'Single-hackathon mode is enabled. Update the current hackathon instead of creating a new one.',
        });
      }
    }

    const titleValue = typeof title === 'string' ? title.trim() : '';
    if (!titleValue) {
      return res.status(400).json({ error: 'title is required' });
    }
    const taglineValue = typeof tagline === 'string' ? tagline.trim() : '';
    if (!taglineValue) {
      return res.status(400).json({ error: 'tagline is required' });
    }
    const startAtValue = asString(startAt);
    const endAtValue = asString(endAt);
    if (!startAtValue || !endAtValue) {
      return res.status(400).json({ error: 'startAt and endAt are required' });
    }
    const docsUrlValue = asString(docsUrl);
    if (docsUrlValue && !isValidHttpUrl(docsUrlValue)) {
      return res.status(400).json({ error: 'docsUrl must be a valid http(s) URL' });
    }
    const submissionSuccessHintTextValue = asString(submissionSuccessHintText) || null;
    const submissionSuccessHintImageUrlValue = asString(submissionSuccessHintImageUrl);
    if (submissionSuccessHintImageUrlValue && !isValidHttpOrRootRelativeUrl(submissionSuccessHintImageUrlValue)) {
      return res.status(400).json({ error: 'submissionSuccessHintImageUrl must be a valid http(s) URL or root-relative path' });
    }
    const statusValue = typeof status === 'string' && status.trim() ? status.trim() : 'draft';
    const coverGradientValue = resolveHackathonCoverGradient(coverGradient);
    const cityValue = asString(city) || null;
    const prizePoolValue = asString(prizePool) || null;
    const hackathonStartAt = new Date(startAtValue);
    const hackathonEndAt = new Date(endAtValue);

    if (Number.isNaN(hackathonStartAt.getTime()) || Number.isNaN(hackathonEndAt.getTime())) {
      return res.status(400).json({ error: 'startAt and endAt must be valid dates' });
    }
    if (hackathonStartAt.getTime() > hackathonEndAt.getTime()) {
      return res.status(400).json({ error: 'startAt must be earlier than or equal to endAt' });
    }

    const hackathon = await prisma.hackathon.create({
      data: {
        title: titleValue,
        tagline: taglineValue,
        city: cityValue,
        startAt: hackathonStartAt,
        endAt: hackathonEndAt,
        status: statusValue,
        coverGradient: coverGradientValue,
        prizePool: prizePoolValue,
        docsUrl: docsUrlValue || null,
        submissionSuccessHintText: submissionSuccessHintTextValue,
        submissionSuccessHintImageUrl: submissionSuccessHintImageUrlValue || null,
        submissionSchema: submissionSchema || {},
        judgesPerProject: typeof judgesPerProject === 'number' && judgesPerProject > 0 ? judgesPerProject : 2,
        scoringCriteria: hasScoringCriteriaInput ? {
          create: scoringCriteriaInputs.map((c) => ({
            name: c.name,
            maxScore: c.maxScore,
            sortOrder: c.sortOrder || 0,
          }))
        } : undefined,
      },
      include: { scoringCriteria: true }
    });
    res.json(hackathon);
  });

  app.put('/api/hackathons/:id', requireAdmin, async (req, res) => {
    const {
      title,
      tagline,
      city,
      startAt,
      endAt,
      status,
      coverGradient,
      submissionSchema,
      scoringCriteria,
      prizePool,
      docsUrl,
      submissionSuccessHintText,
      submissionSuccessHintImageUrl,
      judgesPerProject,
    } = req.body;
    const hasScoringCriteriaInput = Array.isArray(scoringCriteria);
    let scoringCriteriaInputs: ScoringCriterionPayload[] = [];
    if (hasScoringCriteriaInput) {
      const normalized = normalizeScoringCriteriaPayload(scoringCriteria as unknown[]);
      if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
      }
      scoringCriteriaInputs = normalized.criteria || [];
    }
    if (SINGLE_HACKATHON_MODE) {
      const currentHackathon = await getCurrentHackathon(prisma);
      if (currentHackathon && currentHackathon.id !== req.params.id) {
        return res.status(409).json({
          error: 'Single-hackathon mode is enabled. Only the current hackathon can be updated.',
        });
      }
    }
    const existingHackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    });

    if (!existingHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    // Allow status transition (e.g. draft -> active), but block all other field edits once active+
    const LOCKED_STATUSES = new Set(['active', 'judging', 'completed']);
    const isLocked = LOCKED_STATUSES.has(existingHackathon.status);
    const isStatusChangeOnly = status && Object.keys(req.body).filter(k => req.body[k] !== undefined).length === 1;

    if (isLocked && !isStatusChangeOnly) {
      return res.status(403).json({ error: 'Cannot update settings after hackathon has started' });
    }

    const titleValue = title !== undefined ? asString(title) : undefined;
    if (title !== undefined && !titleValue) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    const taglineValue = tagline !== undefined ? asString(tagline) : undefined;
    if (tagline !== undefined && !taglineValue) {
      return res.status(400).json({ error: 'tagline cannot be empty' });
    }

    const startAtValue = startAt !== undefined ? asString(startAt) : undefined;
    if (startAt !== undefined && !startAtValue) {
      return res.status(400).json({ error: 'startAt cannot be empty' });
    }
    const endAtValue = endAt !== undefined ? asString(endAt) : undefined;
    if (endAt !== undefined && !endAtValue) {
      return res.status(400).json({ error: 'endAt cannot be empty' });
    }

    const docsUrlValue = docsUrl !== undefined ? asString(docsUrl) : undefined;
    if (docsUrlValue && !isValidHttpUrl(docsUrlValue)) {
      return res.status(400).json({ error: 'docsUrl must be a valid http(s) URL' });
    }
    const submissionSuccessHintTextValue =
      submissionSuccessHintText !== undefined ? (asString(submissionSuccessHintText) || null) : undefined;
    const submissionSuccessHintImageUrlValue =
      submissionSuccessHintImageUrl !== undefined ? asString(submissionSuccessHintImageUrl) : undefined;
    if (submissionSuccessHintImageUrlValue && !isValidHttpOrRootRelativeUrl(submissionSuccessHintImageUrlValue)) {
      return res.status(400).json({ error: 'submissionSuccessHintImageUrl must be a valid http(s) URL or root-relative path' });
    }

    const cityValue = city !== undefined ? (asString(city) || null) : undefined;
    const prizePoolValue = prizePool !== undefined ? (asString(prizePool) || null) : undefined;

    const nextStartAt = startAtValue ? new Date(startAtValue) : existingHackathon.startAt;
    const nextEndAt = endAtValue ? new Date(endAtValue) : existingHackathon.endAt;
    if (Number.isNaN(nextStartAt.getTime()) || Number.isNaN(nextEndAt.getTime())) {
      return res.status(400).json({ error: 'startAt and endAt must be valid dates' });
    }
    if (nextStartAt.getTime() > nextEndAt.getTime()) {
      return res.status(400).json({ error: 'startAt must be earlier than or equal to endAt' });
    }

    // Use a transaction to update hackathon and scoring criteria atomically,
    // then return the result in a single round trip.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.hackathon.update({
        where: { id: req.params.id },
        data: {
          title: titleValue,
          tagline: taglineValue,
          city: cityValue,
          startAt: startAtValue ? new Date(startAtValue) : undefined,
          endAt: endAtValue ? new Date(endAtValue) : undefined,
          status,
          coverGradient: coverGradient !== undefined ? resolveHackathonCoverGradient(coverGradient) : undefined,
          prizePool: prizePoolValue,
          docsUrl: docsUrl !== undefined ? (docsUrlValue || null) : undefined,
          submissionSuccessHintText: submissionSuccessHintTextValue,
          submissionSuccessHintImageUrl:
            submissionSuccessHintImageUrl !== undefined ? (submissionSuccessHintImageUrlValue || null) : undefined,
          submissionSchema: submissionSchema !== undefined ? submissionSchema : undefined,
          judgesPerProject: typeof judgesPerProject === 'number' && judgesPerProject > 0 ? judgesPerProject : undefined,
        },
      });

      if (hasScoringCriteriaInput) {
        await tx.scoringCriterion.deleteMany({ where: { hackathonId: req.params.id } });
        if (scoringCriteriaInputs.length > 0) {
          await tx.scoringCriterion.createMany({
            data: scoringCriteriaInputs.map((c) => ({
              hackathonId: req.params.id,
              name: c.name,
              maxScore: c.maxScore,
              sortOrder: c.sortOrder || 0,
            })),
          });
        }
      }

      return tx.hackathon.findUnique({
        where: { id: req.params.id },
        include: { scoringCriteria: true },
      });
    });

    res.json(updated);
  });

  // ===== Markdown Documents =====

  app.get('/api/hackathon/markdown-doc', async (_req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const doc = await readHackathonMarkdownDoc(currentHackathon.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  });

  app.put('/api/hackathon/markdown-doc', requireAdmin, markdownDocJsonParser, async (req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const fileName = asString(req.body?.fileName);
    const isBase64 = req.body?.isBase64 === true;

    if (!content.trim()) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    try {
      const doc = await saveHackathonMarkdownDoc(currentHackathon.id, fileName, content, isBase64);
      res.json(doc);
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error, 'Failed to save document') });
    }
  });

  app.delete('/api/hackathon/markdown-doc', requireAdmin, async (_req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    try {
      const deleted = await deleteHackathonMarkdownDoc(currentHackathon.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error, 'Failed to delete document') });
    }
  });

  app.get('/api/hackathons/:id/markdown-doc', async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const doc = await readHackathonMarkdownDoc(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  });

  app.put('/api/hackathons/:id/markdown-doc', requireAdmin, markdownDocJsonParser, async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const fileName = asString(req.body?.fileName);
    const isBase64 = req.body?.isBase64 === true;

    if (!content.trim()) {
      return res.status(400).json({ error: 'Document content is required' });
    }

    try {
      const doc = await saveHackathonMarkdownDoc(req.params.id, fileName, content, isBase64);
      res.json(doc);
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error, 'Failed to save document') });
    }
  });

  app.delete('/api/hackathons/:id/markdown-doc', requireAdmin, async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    try {
      const deleted = await deleteHackathonMarkdownDoc(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json({ success: true });
    } catch (error: unknown) {
      res.status(500).json({ error: getErrorMessage(error, 'Failed to delete document') });
    }
  });
}
