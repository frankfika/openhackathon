import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Hackathons
app.get('/api/hackathons', async (req, res) => {
  const hackathons = await prisma.hackathon.findMany({
    include: { sessions: true }
  });
  res.json(hackathons);
});

app.post('/api/hackathons', async (req, res) => {
  const hackathon = await prisma.hackathon.create({
    data: req.body
  });
  res.json(hackathon);
});

app.put('/api/hackathons/:id', async (req, res) => {
  const hackathon = await prisma.hackathon.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(hackathon);
});

// Projects
app.get('/api/projects', async (req, res) => {
  const { hackathonId } = req.query;
  const projects = await prisma.project.findMany({
    where: hackathonId ? { hackathonId: String(hackathonId) } : undefined,
    include: { user: true }
  });
  res.json(projects);
});

app.post('/api/projects', async (req, res) => {
  const project = await prisma.project.create({
    data: req.body
  });
  res.json(project);
});

// Judging
app.get('/api/assignments', async (req, res) => {
  const assignments = await prisma.assignment.findMany({
    include: { project: true, judge: true }
  });
  res.json(assignments);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
