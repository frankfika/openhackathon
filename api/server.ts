import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ===== Hackathons =====

app.get('/api/hackathons', async (req, res) => {
  const hackathons = await prisma.hackathon.findMany({
    include: { sessions: true, scoringCriteria: true }
  });
  res.json(hackathons);
});

app.get('/api/hackathons/:id', async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    include: { sessions: true, scoringCriteria: true }
  });
  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }
  res.json(hackathon);
});

app.post('/api/hackathons', async (req, res) => {
  const { title, tagline, city, startAt, endAt, status, coverGradient, submissionSchema, sessions, scoringCriteria } = req.body;

  const hackathon = await prisma.hackathon.create({
    data: {
      title,
      tagline,
      city,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status,
      coverGradient,
      submissionSchema: submissionSchema || {},
      sessions: sessions ? {
        create: sessions.map((s: any) => ({
          name: s.name,
          type: s.type,
          status: s.status || 'draft',
          startAt: new Date(s.startAt),
          endAt: new Date(s.endAt),
        }))
      } : undefined,
      scoringCriteria: scoringCriteria ? {
        create: scoringCriteria.map((c: any) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder || 0,
        }))
      } : undefined,
    },
    include: { sessions: true, scoringCriteria: true }
  });
  res.json(hackathon);
});

app.put('/api/hackathons/:id', async (req, res) => {
  const { title, tagline, city, startAt, endAt, status, coverGradient, submissionSchema, sessions, scoringCriteria } = req.body;

  // Update hackathon basic info
  const hackathon = await prisma.hackathon.update({
    where: { id: req.params.id },
    data: {
      title,
      tagline,
      city,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      status,
      coverGradient,
      submissionSchema: submissionSchema !== undefined ? submissionSchema : undefined,
    }
  });

  // Update scoring criteria if provided
  if (scoringCriteria) {
    await prisma.scoringCriterion.deleteMany({ where: { hackathonId: req.params.id } });
    await prisma.scoringCriterion.createMany({
      data: scoringCriteria.map((c: any) => ({
        hackathonId: req.params.id,
        name: c.name,
        maxScore: c.maxScore,
        sortOrder: c.sortOrder || 0,
      }))
    });
  }

  // Update sessions if provided
  if (sessions) {
    for (const session of sessions) {
      if (session.id) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            name: session.name,
            type: session.type,
            status: session.status,
            startAt: new Date(session.startAt),
            endAt: new Date(session.endAt),
          }
        });
      } else {
        await prisma.session.create({
          data: {
            hackathonId: req.params.id,
            name: session.name,
            type: session.type,
            status: session.status || 'draft',
            startAt: new Date(session.startAt),
            endAt: new Date(session.endAt),
          }
        });
      }
    }
  }

  const updated = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    include: { sessions: true, scoringCriteria: true }
  });
  res.json(updated);
});

// ===== Projects =====

app.get('/api/projects', async (req, res) => {
  const { hackathonId, sessionId } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      ...(hackathonId ? { hackathonId: String(hackathonId) } : {}),
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
    },
    include: {
      user: true,
      assignments: {
        include: { judge: true, scores: true }
      },
      hackathon: true,
      session: true,
    }
  });
  res.json(projects);
});

app.get('/api/projects/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      user: true,
      assignments: {
        include: { judge: true, scores: true }
      },
      hackathon: { include: { scoringCriteria: true } },
      session: true,
    }
  });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

app.post('/api/projects', async (req, res) => {
  const { hackathonId, sessionId, title, oneLiner, description, tags, demoUrl, repoUrl, submitterEmail, submitterName, submissionData } = req.body;

  const project = await prisma.project.create({
    data: {
      hackathonId,
      sessionId,
      title,
      oneLiner,
      description,
      tags: tags || [],
      demoUrl,
      repoUrl,
      submitterEmail,
      submitterName,
      submissionData: submissionData || {},
    },
    include: {
      hackathon: { include: { scoringCriteria: true } },
      session: true,
    }
  });
  res.json(project);
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { title, oneLiner, description, tags, demoUrl, repoUrl, submissionData, status } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        title,
        oneLiner,
        description,
        tags: tags || [],
        demoUrl,
        repoUrl,
        submissionData: submissionData || {},
      }
    });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
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

// ===== Assignments =====

app.get('/api/assignments', async (req, res) => {
  const { sessionId, projectId, judgeId, status } = req.query;
  const assignments = await prisma.assignment.findMany({
    where: {
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(judgeId ? { judgeId: String(judgeId) } : {}),
      ...(status ? { status: String(status) } : {}),
    },
    include: {
      project: true,
      judge: true,
      session: true,
      scores: true,
    }
  });
  res.json(assignments);
});

app.post('/api/assignments', async (req, res) => {
  const { assignments } = req.body; // Array of { sessionId, projectId, judgeId }

  const created = await prisma.$transaction(
    assignments.map((a: any) =>
      prisma.assignment.upsert({
        where: {
          sessionId_projectId_judgeId: {
            sessionId: a.sessionId,
            projectId: a.projectId,
            judgeId: a.judgeId,
          }
        },
        update: {},
        create: {
          sessionId: a.sessionId,
          projectId: a.projectId,
          judgeId: a.judgeId,
          status: 'pending',
        },
      })
    )
  );

  res.json(created);
});

app.delete('/api/assignments/:id', async (req, res) => {
  try {
    await prisma.assignment.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// ===== Scores =====

app.post('/api/assignments/:id/scores', async (req, res) => {
  const { scores, comment, status } = req.body; // scores: [{ criterionId, score }]
  const assignmentId = req.params.id;

  // Calculate total score
  const totalScore = scores.reduce((sum: number, s: any) => sum + s.score, 0);

  // Delete existing scores for this assignment
  await prisma.score.deleteMany({
    where: { assignmentId }
  });

  // Create new scores
  await prisma.score.createMany({
    data: scores.map((s: any) => ({
      assignmentId,
      criterionId: s.criterionId,
      score: s.score,
    }))
  });

  // Update assignment
  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: status || 'completed',
      comment,
      totalScore,
    },
    include: {
      project: true,
      judge: true,
      scores: true,
    }
  });

  res.json(assignment);
});

// ===== Dashboard Stats =====

app.get('/api/dashboard/stats', async (req, res) => {
  const { hackathonId, userId, role } = req.query;

  const stats: any = {};

  if (role === 'admin') {
    const totalProjects = await prisma.project.count({
      where: hackathonId ? { hackathonId: String(hackathonId) } : {}
    });
    const totalJudges = await prisma.user.count({ where: { role: 'judge' } });
    const totalAssignments = await prisma.assignment.count({
      where: hackathonId
        ? { session: { hackathonId: String(hackathonId) } }
        : {}
    });
    const completedAssignments = await prisma.assignment.count({
      where: {
        status: 'completed',
        ...(hackathonId ? { session: { hackathonId: String(hackathonId) } } : {})
      }
    });

    stats.totalProjects = totalProjects;
    stats.totalJudges = totalJudges;
    stats.totalAssignments = totalAssignments;
    stats.completedAssignments = completedAssignments;
    stats.pendingReviews = totalAssignments - completedAssignments;
  } else if (role === 'judge') {
    const myAssignments = await prisma.assignment.count({
      where: { judgeId: String(userId) }
    });
    const completed = await prisma.assignment.count({
      where: { judgeId: String(userId), status: 'completed' }
    });
    const pending = await prisma.assignment.count({
      where: { judgeId: String(userId), status: 'pending' }
    });

    stats.totalAssignments = myAssignments;
    stats.completed = completed;
    stats.pending = pending;
  }

  res.json(stats);
});

// ===== Leaderboard =====

// Get auto-calculated leaderboard (scores-based)
app.get('/api/leaderboard', async (req, res) => {
  const { hackathonId, sessionId } = req.query;

  const hackathon = hackathonId ? await prisma.hackathon.findUnique({
    where: { id: String(hackathonId) },
    select: { leaderboardData: true, leaderboardPublished: true }
  }) : null;

  // If published, return curated leaderboard
  if (hackathon?.leaderboardPublished && hackathon?.leaderboardData) {
    const entries = hackathon.leaderboardData as { projectId: string; rank: number; award: string }[];
    const projectIds = entries.map(e => e.projectId);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      include: {
        assignments: { where: { status: 'completed' }, select: { totalScore: true } },
        hackathon: { include: { scoringCriteria: true } },
      }
    });

    const result = entries.map(entry => {
      const p = projects.find(p => p.id === entry.projectId);
      if (!p) return null;
      const scores = p.assignments.map(a => a.totalScore || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const maxPossible = p.hackathon.scoringCriteria.reduce((sum, c) => sum + c.maxScore, 0);
      return {
        id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
        avgScore: Math.round(avgScore * 100) / 100, maxPossible,
        judgeCount: scores.length, submitterName: p.submitterName,
        rank: entry.rank, award: entry.award,
      };
    }).filter(Boolean);

    result.sort((a: any, b: any) => a.rank - b.rank);
    return res.json(result);
  }

  // Otherwise return scores-based ranking
  const projects = await prisma.project.findMany({
    where: {
      ...(hackathonId ? { hackathonId: String(hackathonId) } : {}),
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
    },
    include: {
      assignments: {
        where: { status: 'completed' },
        select: { totalScore: true }
      },
      hackathon: { include: { scoringCriteria: true } },
    }
  });

  const leaderboard = projects.map(p => {
    const scores = p.assignments.map(a => a.totalScore || 0);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    const maxPossible = p.hackathon.scoringCriteria.reduce((sum, c) => sum + c.maxScore, 0);

    return {
      id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
      avgScore: Math.round(avgScore * 100) / 100, maxPossible,
      judgeCount: scores.length, submitterName: p.submitterName,
    };
  });

  leaderboard.sort((a, b) => b.avgScore - a.avgScore);
  res.json(leaderboard);
});

// Save curated leaderboard
app.put('/api/hackathons/:id/leaderboard', async (req, res) => {
  const { entries, published } = req.body;
  const hackathon = await prisma.hackathon.update({
    where: { id: req.params.id },
    data: {
      leaderboardData: entries,
      leaderboardPublished: published,
    }
  });
  res.json(hackathon);
});

// Get curated leaderboard data (admin)
app.get('/api/hackathons/:id/leaderboard', async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: { leaderboardData: true, leaderboardPublished: true }
  });
  res.json(hackathon);
});

// ===== Scoring Report =====

app.get('/api/reports/scoring', async (req, res) => {
  const { hackathonId, sessionId } = req.query;

  const assignments = await prisma.assignment.findMany({
    where: {
      status: 'completed',
      ...(hackathonId ? { session: { hackathonId: String(hackathonId) } } : {}),
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
    },
    include: {
      project: true,
      judge: true,
      scores: true,
      session: true,
    }
  });

  const report = assignments.map(a => ({
    assignmentId: a.id,
    projectId: a.projectId,
    projectTitle: a.project.title,
    judgeId: a.judgeId,
    judgeName: a.judge.name,
    sessionName: a.session.name,
    totalScore: a.totalScore,
    comment: a.comment,
    scores: a.scores,
    createdAt: a.createdAt,
  }));

  res.json(report);
});

// ===== Users =====

app.get('/api/users', async (req, res) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: String(role) } : {},
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
  });
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role || 'judge',
      },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
    });
    res.json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    // Delete scores, then assignments, then user
    await prisma.score.deleteMany({
      where: { assignment: { judgeId: req.params.id } }
    });
    await prisma.assignment.deleteMany({
      where: { judgeId: req.params.id }
    });
    await prisma.user.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ===== Auth =====

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
