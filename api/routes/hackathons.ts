import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import { SINGLE_HACKATHON_MODE, MARKDOWN_DOC_BODY_LIMIT, VALID_HACKATHON_STATUSES, VALID_HACKATHON_SOURCES, VALID_SYNC_STATUSES, asString } from '../config';
import type { ScoringCriterionPayload } from '../types';
import { isValidHttpUrl, isValidHttpOrRootRelativeUrl, getErrorMessage, normalizeScoringCriteriaPayload, MAX_TITLE_LENGTH, MAX_TAGLINE_LENGTH, MAX_CITY_LENGTH, MAX_PRIZE_POOL_LENGTH, MAX_URL_LENGTH, MAX_ORGANIZER_LENGTH, MAX_EXTERNAL_URL_LENGTH } from '../utils/validation';
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

  app.get('/api/hackathons', async (req, res) => {
    const { source } = req.query;
    const where = typeof source === 'string' && source.trim()
      ? { source: source.trim().toLowerCase() }
      : {};
    const hackathons = await prisma.hackathon.findMany({
      where,
      include: { scoringCriteria: true },
    });
    const sorted = hackathons.sort((a, b) => {
      const priority: Record<string, number> = {
        active: 0, judging: 1, upcoming: 2, draft: 3, completed: 4,
      };
      const pa = priority[a.status] ?? 5;
      const pb = priority[b.status] ?? 5;
      if (pa !== pb) return pa - pb;
      return b.startAt.getTime() - a.startAt.getTime();
    });
    if (SINGLE_HACKATHON_MODE) {
      return res.json(sorted.length > 0 ? [sorted[0]] : []);
    }
    res.json(sorted);
  });

  app.get('/api/hackathons/:id', async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      include: { scoringCriteria: true, externalConfig: true },
    });
    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }
    res.json(hackathon);
  });

  app.get('/api/hackathons/external/sources', async (_req, res) => {
    const rows = await prisma.hackathon.groupBy({ by: ['source'] });
    const sources = rows.map((r) => r.source).filter(Boolean);
    res.json(sources);
  });

  app.post('/api/hackathons', requireAdmin, async (req, res) => {
    const {
      title, tagline, city, startAt, endAt, status, coverGradient,
      submissionSchema, scoringCriteria, prizePool, docsUrl,
      submissionSuccessHintText, submissionSuccessHintImageUrl, judgesPerProject,
      source, organizer, externalUrl, syncStatus, externalConfig,
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

    // --- Validation ---
    const titleValue = typeof title === 'string' ? title.trim() : '';
    if (!titleValue) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (titleValue.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` });
    }
    const taglineValue = typeof tagline === 'string' ? tagline.trim() : '';
    if (!taglineValue) {
      return res.status(400).json({ error: 'tagline is required' });
    }
    if (taglineValue.length > MAX_TAGLINE_LENGTH) {
      return res.status(400).json({ error: `tagline must be at most ${MAX_TAGLINE_LENGTH} characters` });
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
    if (docsUrlValue && docsUrlValue.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: `docsUrl must be at most ${MAX_URL_LENGTH} characters` });
    }
    const submissionSuccessHintTextValue = asString(submissionSuccessHintText) || null;
    const submissionSuccessHintImageUrlValue = asString(submissionSuccessHintImageUrl);
    if (submissionSuccessHintImageUrlValue && !isValidHttpOrRootRelativeUrl(submissionSuccessHintImageUrlValue)) {
      return res.status(400).json({ error: 'submissionSuccessHintImageUrl must be a valid http(s) URL or root-relative path' });
    }
    const statusValue = typeof status === 'string' && status.trim()
      ? status.trim().toLowerCase()
      : 'draft';
    if (!VALID_HACKATHON_STATUSES.has(statusValue)) {
      return res.status(400).json({ error: `status must be one of: ${Array.from(VALID_HACKATHON_STATUSES).join(', ')}` });
    }
    const sourceValue = typeof source === 'string' && source.trim()
      ? source.trim().toLowerCase()
      : 'openhackathon';
    if (!VALID_HACKATHON_SOURCES.has(sourceValue)) {
      return res.status(400).json({ error: `source must be one of: ${Array.from(VALID_HACKATHON_SOURCES).join(', ')}` });
    }
    const organizerValue = asString(organizer) || 'OpenHackathon';
    if (organizerValue.length > MAX_ORGANIZER_LENGTH) {
      return res.status(400).json({ error: `organizer must be at most ${MAX_ORGANIZER_LENGTH} characters` });
    }
    const externalUrlValue = asString(externalUrl);
    if (externalUrlValue && !isValidHttpUrl(externalUrlValue)) {
      return res.status(400).json({ error: 'externalUrl must be a valid http(s) URL' });
    }
    if (externalUrlValue && externalUrlValue.length > MAX_EXTERNAL_URL_LENGTH) {
      return res.status(400).json({ error: `externalUrl must be at most ${MAX_EXTERNAL_URL_LENGTH} characters` });
    }
    const syncStatusValue = typeof syncStatus === 'string' && syncStatus.trim()
      ? syncStatus.trim().toLowerCase()
      : 'manual';
    if (!VALID_SYNC_STATUSES.has(syncStatusValue)) {
      return res.status(400).json({ error: `syncStatus must be one of: ${Array.from(VALID_SYNC_STATUSES).join(', ')}` });
    }
    const coverGradientValue = resolveHackathonCoverGradient(coverGradient);
    const cityValue = asString(city) || null;
    if (cityValue && cityValue.length > MAX_CITY_LENGTH) {
      return res.status(400).json({ error: `city must be at most ${MAX_CITY_LENGTH} characters` });
    }
    const prizePoolValue = asString(prizePool) || null;
    if (prizePoolValue && prizePoolValue.length > MAX_PRIZE_POOL_LENGTH) {
      return res.status(400).json({ error: `prizePool must be at most ${MAX_PRIZE_POOL_LENGTH} characters` });
    }
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
        source: sourceValue,
        organizer: organizerValue,
        externalUrl: externalUrlValue || null,
        syncStatus: syncStatusValue,
        scoringCriteria: hasScoringCriteriaInput ? {
          create: scoringCriteriaInputs.map((c) => ({
            name: c.name,
            maxScore: c.maxScore,
            sortOrder: c.sortOrder || 0,
          }))
        } : undefined,
        externalConfig: externalConfig && typeof externalConfig === 'object' ? {
          create: {
            allowSubmit: typeof externalConfig.allowSubmit === 'boolean' ? externalConfig.allowSubmit : true,
            enableJudging: typeof externalConfig.enableJudging === 'boolean' ? externalConfig.enableJudging : true,
            submitRedirectUrl: asString(externalConfig.submitRedirectUrl) || null,
            tags: Array.isArray(externalConfig.tags) ? externalConfig.tags.filter((t: unknown) => typeof t === 'string') : [],
            adminNotes: asString(externalConfig.adminNotes) || null,
          }
        } : undefined,
      },
      include: { scoringCriteria: true, externalConfig: true },
    });
    res.json(hackathon);
  });

  app.put('/api/hackathons/:id', requireAdmin, async (req, res) => {
    const {
      title, tagline, city, startAt, endAt, status, coverGradient,
      submissionSchema, scoringCriteria, prizePool, docsUrl,
      submissionSuccessHintText, submissionSuccessHintImageUrl, judgesPerProject,
      source, organizer, externalUrl, syncStatus, externalConfig,
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
      select: { id: true, status: true, startAt: true, endAt: true },
    });
    if (!existingHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    // Allow status transition (e.g. draft -> active), but block all other field edits once active+
    const LOCKED_STATUSES = new Set(['active', 'judging', 'completed']);
    const statusValue = status !== undefined ? asString(status)?.toLowerCase() : undefined;
    if (status !== undefined && !statusValue) {
      return res.status(400).json({ error: 'status cannot be empty' });
    }
    if (statusValue && !VALID_HACKATHON_STATUSES.has(statusValue)) {
      return res.status(400).json({ error: `status must be one of: ${Array.from(VALID_HACKATHON_STATUSES).join(', ')}` });
    }
    const isLocked = LOCKED_STATUSES.has(existingHackathon.status);
    const isStatusChangeOnly = Boolean(statusValue) && Object.keys(req.body).filter(k => req.body[k] !== undefined).length === 1;
    if (isLocked && !isStatusChangeOnly) {
      return res.status(403).json({ error: 'Cannot update settings after hackathon has started' });
    }

    const titleValue = title !== undefined ? asString(title) : undefined;
    if (title !== undefined && !titleValue) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    if (titleValue && titleValue.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `title must be at most ${MAX_TITLE_LENGTH} characters` });
    }
    const taglineValue = tagline !== undefined ? asString(tagline) : undefined;
    if (tagline !== undefined && !taglineValue) {
      return res.status(400).json({ error: 'tagline cannot be empty' });
    }
    if (taglineValue && taglineValue.length > MAX_TAGLINE_LENGTH) {
      return res.status(400).json({ error: `tagline must be at most ${MAX_TAGLINE_LENGTH} characters` });
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
    if (docsUrlValue && docsUrlValue.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: `docsUrl must be at most ${MAX_URL_LENGTH} characters` });
    }
    const submissionSuccessHintTextValue =
      submissionSuccessHintText !== undefined ? (asString(submissionSuccessHintText) || null) : undefined;
    const submissionSuccessHintImageUrlValue =
      submissionSuccessHintImageUrl !== undefined ? asString(submissionSuccessHintImageUrl) : undefined;
    if (submissionSuccessHintImageUrlValue && !isValidHttpOrRootRelativeUrl(submissionSuccessHintImageUrlValue)) {
      return res.status(400).json({ error: 'submissionSuccessHintImageUrl must be a valid http(s) URL or root-relative path' });
    }
    const cityValue = city !== undefined ? (asString(city) || null) : undefined;
    if (cityValue && cityValue.length > MAX_CITY_LENGTH) {
      return res.status(400).json({ error: `city must be at most ${MAX_CITY_LENGTH} characters` });
    }
    const prizePoolValue = prizePool !== undefined ? (asString(prizePool) || null) : undefined;
    if (prizePoolValue && prizePoolValue.length > MAX_PRIZE_POOL_LENGTH) {
      return res.status(400).json({ error: `prizePool must be at most ${MAX_PRIZE_POOL_LENGTH} characters` });
    }
    const sourceValue = source !== undefined
      ? (typeof source === 'string' && source.trim() ? source.trim().toLowerCase() : undefined)
      : undefined;
    if (sourceValue && !VALID_HACKATHON_SOURCES.has(sourceValue)) {
      return res.status(400).json({ error: `source must be one of: ${Array.from(VALID_HACKATHON_SOURCES).join(', ')}` });
    }
    const organizerValue = organizer !== undefined ? (asString(organizer) || null) : undefined;
    if (organizerValue && organizerValue.length > MAX_ORGANIZER_LENGTH) {
      return res.status(400).json({ error: `organizer must be at most ${MAX_ORGANIZER_LENGTH} characters` });
    }
    const externalUrlValue = externalUrl !== undefined ? asString(externalUrl) : undefined;
    if (externalUrlValue && !isValidHttpUrl(externalUrlValue)) {
      return res.status(400).json({ error: 'externalUrl must be a valid http(s) URL' });
    }
    if (externalUrlValue && externalUrlValue.length > MAX_EXTERNAL_URL_LENGTH) {
      return res.status(400).json({ error: `externalUrl must be at most ${MAX_EXTERNAL_URL_LENGTH} characters` });
    }
    const syncStatusValue = syncStatus !== undefined
      ? (typeof syncStatus === 'string' && syncStatus.trim() ? syncStatus.trim().toLowerCase() : undefined)
      : undefined;
    if (syncStatusValue && !VALID_SYNC_STATUSES.has(syncStatusValue)) {
      return res.status(400).json({ error: `syncStatus must be one of: ${Array.from(VALID_SYNC_STATUSES).join(', ')}` });
    }

    const nextStartAt = startAtValue ? new Date(startAtValue) : existingHackathon.startAt;
    const nextEndAt = endAtValue ? new Date(endAtValue) : existingHackathon.endAt;
    if (Number.isNaN(nextStartAt.getTime()) || Number.isNaN(nextEndAt.getTime())) {
      return res.status(400).json({ error: 'startAt and endAt must be valid dates' });
    }
    if (nextStartAt.getTime() > nextEndAt.getTime()) {
      return res.status(400).json({ error: 'startAt must be earlier than or equal to endAt' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.hackathon.update({
        where: { id: req.params.id },
        data: {
          title: titleValue,
          tagline: taglineValue,
          city: cityValue,
          startAt: startAtValue ? new Date(startAtValue) : undefined,
          endAt: endAtValue ? new Date(endAtValue) : undefined,
          status: statusValue,
          coverGradient: coverGradient !== undefined ? resolveHackathonCoverGradient(coverGradient) : undefined,
          prizePool: prizePoolValue,
          docsUrl: docsUrl !== undefined ? (docsUrlValue || null) : undefined,
          submissionSuccessHintText: submissionSuccessHintTextValue,
          submissionSuccessHintImageUrl:
            submissionSuccessHintImageUrl !== undefined ? (submissionSuccessHintImageUrlValue || null) : undefined,
          submissionSchema: submissionSchema !== undefined ? submissionSchema : undefined,
          judgesPerProject: typeof judgesPerProject === 'number' && judgesPerProject > 0 ? judgesPerProject : undefined,
          source: sourceValue,
          organizer: organizerValue,
          externalUrl: externalUrl !== undefined ? (externalUrlValue || null) : undefined,
          syncStatus: syncStatusValue,
          syncedAt: syncStatusValue === 'synced' ? new Date() : undefined,
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

      // Upsert external config if provided
      if (externalConfig && typeof externalConfig === 'object') {
        await tx.externalHackathonConfig.upsert({
          where: { hackathonId: req.params.id },
          create: {
            hackathonId: req.params.id,
            allowSubmit: typeof externalConfig.allowSubmit === 'boolean' ? externalConfig.allowSubmit : true,
            enableJudging: typeof externalConfig.enableJudging === 'boolean' ? externalConfig.enableJudging : true,
            submitRedirectUrl: asString(externalConfig.submitRedirectUrl) || null,
            tags: Array.isArray(externalConfig.tags) ? externalConfig.tags.filter((t: unknown) => typeof t === 'string') : [],
            adminNotes: asString(externalConfig.adminNotes) || null,
          },
          update: {
            allowSubmit: typeof externalConfig.allowSubmit === 'boolean' ? externalConfig.allowSubmit : undefined,
            enableJudging: typeof externalConfig.enableJudging === 'boolean' ? externalConfig.enableJudging : undefined,
            submitRedirectUrl: externalConfig.submitRedirectUrl !== undefined ? (asString(externalConfig.submitRedirectUrl) || null) : undefined,
            tags: Array.isArray(externalConfig.tags) ? externalConfig.tags.filter((t: unknown) => typeof t === 'string') : undefined,
            adminNotes: externalConfig.adminNotes !== undefined ? (asString(externalConfig.adminNotes) || null) : undefined,
          },
        });
      }

      return tx.hackathon.findUnique({
        where: { id: req.params.id },
        include: { scoringCriteria: true, externalConfig: true },
      });
    });

    res.json(updated);
  });

  // ===== External Hackathon Config =====

  app.get('/api/hackathons/:id/external-config', async (req, res) => {
    const config = await prisma.externalHackathonConfig.findUnique({
      where: { hackathonId: req.params.id },
    });
    if (!config) {
      return res.status(404).json({ error: 'External config not found' });
    }
    res.json(config);
  });

  app.put('/api/hackathons/:id/external-config', requireAdmin, async (req, res) => {
    const { allowSubmit, enableJudging, submitRedirectUrl, tags, adminNotes } = req.body;
    const existing = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }
    const updated = await prisma.externalHackathonConfig.upsert({
      where: { hackathonId: req.params.id },
      create: {
        hackathonId: req.params.id,
        allowSubmit: typeof allowSubmit === 'boolean' ? allowSubmit : true,
        enableJudging: typeof enableJudging === 'boolean' ? enableJudging : true,
        submitRedirectUrl: asString(submitRedirectUrl) || null,
        tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string') : [],
        adminNotes: asString(adminNotes) || null,
      },
      update: {
        allowSubmit: typeof allowSubmit === 'boolean' ? allowSubmit : undefined,
        enableJudging: typeof enableJudging === 'boolean' ? enableJudging : undefined,
        submitRedirectUrl: submitRedirectUrl !== undefined ? (asString(submitRedirectUrl) || null) : undefined,
        tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string') : undefined,
        adminNotes: adminNotes !== undefined ? (asString(adminNotes) || null) : undefined,
      },
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
