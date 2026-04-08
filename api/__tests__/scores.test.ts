import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, prisma } from '../server';
import {
  createHackathon,
  createUser,
  createProject,
  createAssignment,
} from './factories';

describe('Scores API', () => {
  describe('POST /api/assignments/:id/scores', () => {
    it('allows judge to submit scores for their assignment', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      const res = await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: Math.floor(c.maxScore / 2) })),
          comment: 'Good work overall',
          status: 'completed',
        })
        .expect(200);

      expect(res.body.status).toBe('completed');
      expect(res.body.totalScore).toBe(50); // 30 + 20
      expect(res.body.comment).toBe('Good work overall');
      expect(res.body.scores).toHaveLength(2);
    });

    it('allows judge to update existing scores', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      // First submission
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: 10 })),
          status: 'completed',
        });

      // Update scores
      const res = await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: c.maxScore })),
          status: 'completed',
        })
        .expect(200);

      expect(res.body.totalScore).toBe(100); // 60 + 40

      // Verify old scores were replaced
      const scoreCount = await prisma.score.count({
        where: { assignmentId: assignment.id },
      });
      expect(scoreCount).toBe(2);
    });

    it('rejects scores from non-assigned judge', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const otherJudge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', otherJudge.id)
        .set('x-test-email', otherJudge.email)
        .set('x-test-name', otherJudge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: 50 })),
        })
        .expect(403);
    });

    it('rejects scores for non-existent assignment', async () => {
      const judge = await createUser(prisma, { role: 'judge' });
      const hackathon = await createHackathon(prisma);
      const criteria = hackathon.scoringCriteria;

      await request(app)
        .post('/api/assignments/non-existent-id/scores')
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: 50 })),
        })
        .expect(404);
    });

    it('validates scores are within allowed range', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      // Try to submit score above max
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: [{ criterionId: criteria[0].id, score: 999 }],
        })
        .expect(400);
    });

    it('rejects negative scores', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: [{ criterionId: criteria[0].id, score: -5 }],
        })
        .expect(400);
    });

    it('requires all criteria to be scored', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      // Only submit for first criterion
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: [{ criterionId: criteria[0].id, score: 50 }],
        })
        .expect(400);
    });

    it('rejects duplicate criteria in scores', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: [
            { criterionId: criteria[0].id, score: 30 },
            { criterionId: criteria[0].id, score: 30 }, // Duplicate
          ],
        })
        .expect(400);
    });

    it('rejects unknown criterion IDs', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);

      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: [
            { criterionId: 'invalid-id', score: 50 },
          ],
        })
        .expect(400);
    });

    it('validates scores payload structure', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);

      // Missing scores array
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({ comment: 'Good' })
        .expect(400);

      // Empty scores array
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({ scores: [] })
        .expect(400);

      // Invalid score format
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: [{ criterionId: hackathon.scoringCriteria[0].id, score: 'invalid' }],
        })
        .expect(400);
    });

    it('creates activity log entry when scoring', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: Math.floor(c.maxScore / 2) })),
          status: 'completed',
        })
        .expect(200);

      // Verify activity log was created
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          action: 'score',
          entityType: 'score',
          entityId: assignment.id,
        },
      });

      expect(activityLogs).toHaveLength(1);
      expect(activityLogs[0].actorId).toBe(judge.id);
      expect(activityLogs[0].hackathonId).toBe(hackathon.id);
    });

    it('creates update_score activity when updating', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      // First score
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: 10 })),
          status: 'completed',
        });

      // Update score
      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: 20 })),
          status: 'completed',
        })
        .expect(200);

      const updateActivityLogs = await prisma.activityLog.findMany({
        where: {
          action: 'update_score',
          entityId: assignment.id,
        },
      });

      expect(updateActivityLogs).toHaveLength(1);
    });

    it('supports in_progress status without completing', async () => {
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id);
      const criteria = hackathon.scoringCriteria;

      const res = await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({
          scores: criteria.map((c) => ({ criterionId: c.id, score: Math.floor(c.maxScore / 2) })),
          status: 'in_progress',
        })
        .expect(200);

      expect(res.body.status).toBe('in_progress');
      expect(res.body.totalScore).toBe(50);
    });
  });
});
