#!/usr/bin/env node
/**
 * OpenHackathon Screenshot Capture Script
 * Generates beautiful screenshots for README
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const assetsDir = join(rootDir, 'docs', 'assets');

const VIEWPORT = { width: 1440, height: 900 };

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name, options = {}) {
  const path = join(assetsDir, `${name}.png`);
  const { width = VIEWPORT.width, height = VIEWPORT.height, wait = 1000 } = options;

  await page.setViewportSize({ width, height });
  await sleep(wait);
  await page.screenshot({ path, type: 'png' });

  console.log(`📸 Screenshot saved: ${path}`);
  return path;
}

async function captureScreenshots() {
  // Create assets directory
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  try {
    // 1. Landing Page - Hero Section
    console.log('\n📷 Creating landing page screenshot...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
            min-height: 100vh;
          }
          .navbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 60px;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
          }
          .logo { font-size: 24px; font-weight: 700; color: white; display: flex; align-items: center; gap: 10px; }
          .nav-links { display: flex; gap: 30px; color: white; opacity: 0.9; }
          .hero {
            text-align: center;
            padding: 100px 60px;
            color: white;
          }
          .hero h1 { font-size: 56px; font-weight: 800; margin-bottom: 20px; line-height: 1.1; }
          .hero p { font-size: 20px; opacity: 0.9; margin-bottom: 40px; max-width: 600px; margin-left: auto; margin-right: auto; }
          .cta-buttons { display: flex; gap: 16px; justify-content: center; }
          .btn-primary {
            background: white;
            color: #6366f1;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            border: none;
            cursor: pointer;
          }
          .btn-secondary {
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            border: 1px solid rgba(255,255,255,0.3);
            cursor: pointer;
          }
          .features {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            padding: 0 60px 60px;
            max-width: 1200px;
            margin: 0 auto;
          }
          .feature-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 32px;
            color: white;
            border: 1px solid rgba(255,255,255,0.2);
          }
          .feature-icon { font-size: 32px; margin-bottom: 16px; }
          .feature-card h3 { font-size: 18px; margin-bottom: 8px; }
          .feature-card p { font-size: 14px; opacity: 0.8; }
        </style>
      </head>
      <body>
        <nav class="navbar">
          <div class="logo">◆ OpenHackathon</div>
          <div class="nav-links">
            <span>Home</span>
            <span>Projects</span>
            <span>Leaderboard</span>
            <span>Docs</span>
          </div>
        </nav>
        <section class="hero">
          <h1>Global AI Challenge 2026</h1>
          <p>Redefining the future with Generative AI. Join the world's largest AI hackathon.</p>
          <div class="cta-buttons">
            <button class="btn-primary">Submit Project</button>
            <button class="btn-secondary">View Projects</button>
          </div>
        </section>
        <section class="features">
          <div class="feature-card">
            <div class="feature-icon">🏆</div>
            <h3>$50,000 Prize Pool</h3>
            <p>Compete for cash prizes and industry recognition</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>500+ Participants</h3>
            <p>Join a global community of innovators</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>48 Hours</h3>
            <p>Build something amazing this weekend</p>
          </div>
        </section>
      </body>
      </html>
    `);
    await captureScreenshot(page, 'landing', { wait: 500 });

    // 2. Admin Dashboard
    console.log('📷 Creating admin dashboard...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            min-height: 100vh;
          }
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 260px;
            height: 100vh;
            background: white;
            border-right: 1px solid #e2e8f0;
            padding: 24px;
          }
          .sidebar-logo { font-size: 20px; font-weight: 700; color: #6366f1; margin-bottom: 32px; display: flex; align-items: center; gap: 8px; }
          .nav-item {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 4px;
            color: #64748b;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .nav-item.active { background: #eef2ff; color: #6366f1; font-weight: 500; }
          .main {
            margin-left: 260px;
            padding: 32px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }
          .header h1 { font-size: 28px; font-weight: 700; color: #1e293b; }
          .hackathon-switcher {
            background: white;
            border: 1px solid #e2e8f0;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 14px;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 32px;
          }
          .stat-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            border: 1px solid #e2e8f0;
          }
          .stat-label { font-size: 14px; color: #64748b; margin-bottom: 8px; }
          .stat-value { font-size: 32px; font-weight: 700; color: #1e293b; }
          .stat-change { font-size: 12px; color: #22c55e; margin-top: 4px; }
          .content-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 24px;
          }
          .card {
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }
          .card-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
            color: #1e293b;
          }
          .card-content { padding: 24px; }
          .project-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #f1f5f9;
          }
          .project-row:last-child { border-bottom: none; }
          .project-info h4 { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
          .project-info p { font-size: 13px; color: #64748b; }
          .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-submitted { background: #dcfce7; color: #166534; }
          .status-pending { background: #fef3c7; color: #92400e; }
        </style>
      </head>
      <body>
        <aside class="sidebar">
          <div class="sidebar-logo">◆ OpenHackathon</div>
          <div class="nav-item active">📊 Dashboard</div>
          <div class="nav-item">🏆 Hackathons</div>
          <div class="nav-item">📁 Projects</div>
          <div class="nav-item">⚖️ Judging</div>
          <div class="nav-item">📋 Assignments</div>
          <div class="nav-item">🏅 Leaderboard</div>
          <div class="nav-item">📈 Reports</div>
          <div class="nav-item">⚙️ Settings</div>
        </aside>
        <main class="main">
          <div class="header">
            <h1>Dashboard</h1>
            <div class="hackathon-switcher">
              🏆 Global AI Challenge 2026
              <span>▼</span>
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Projects</div>
              <div class="stat-value">42</div>
              <div class="stat-change">↑ 12% from last week</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Active Judges</div>
              <div class="stat-value">8</div>
              <div class="stat-change">↑ 2 new this week</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Assignments</div>
              <div class="stat-value">156</div>
              <div class="stat-change">85% completed</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Pending Reviews</div>
              <div class="stat-value">23</div>
              <div class="stat-change">↓ 5 from yesterday</div>
            </div>
          </div>
          <div class="content-grid">
            <div class="card">
              <div class="card-header">Recent Submissions</div>
              <div class="card-content">
                <div class="project-row">
                  <div class="project-info">
                    <h4>SmartDoc Assistant</h4>
                    <p>AI-powered medical documentation • Dave Builder</p>
                  </div>
                  <span class="status-badge status-submitted">Submitted</span>
                </div>
                <div class="project-row">
                  <div class="project-info">
                    <h4>CodeGenie</h4>
                    <p>Figma to React code generator • Eve Coder</p>
                  </div>
                  <span class="status-badge status-submitted">Submitted</span>
                </div>
                <div class="project-row">
                  <div class="project-info">
                    <h4>LegalEagle</h4>
                    <p>Automated contract review • Frank Founder</p>
                  </div>
                  <span class="status-badge status-pending">Draft</span>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-header">Quick Actions</div>
              <div class="card-content">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <button style="padding: 12px; background: #6366f1; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">+ New Hackathon</button>
                  <button style="padding: 12px; background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 500; cursor: pointer;">📤 Export Data</button>
                  <button style="padding: 12px; background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 500; cursor: pointer;">👥 Manage Judges</button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
      </html>
    `);
    await captureScreenshot(page, 'dashboard', { wait: 500 });

    // 3. Judging Interface
    console.log('📷 Creating judging interface...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            min-height: 100vh;
          }
          .navbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 32px;
            background: white;
            border-bottom: 1px solid #e2e8f0;
          }
          .nav-logo { font-size: 18px; font-weight: 700; color: #6366f1; }
          .nav-user { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #475569; }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px;
          }
          .back-link { color: #64748b; font-size: 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 6px; }
          .project-header {
            background: white;
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 24px;
            border: 1px solid #e2e8f0;
          }
          .project-title { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
          .project-tagline { font-size: 16px; color: #64748b; margin-bottom: 20px; }
          .project-meta { display: flex; gap: 20px; flex-wrap: wrap; }
          .meta-item { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #475569; }
          .tag { background: #eef2ff; color: #6366f1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
          .two-column { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
          .card {
            background: white;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }
          .card-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
            color: #1e293b;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .card-content { padding: 24px; }
          .criterion {
            margin-bottom: 28px;
          }
          .criterion:last-child { margin-bottom: 0; }
          .criterion-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
          .criterion-name { font-weight: 600; color: #1e293b; }
          .criterion-score { font-weight: 700; color: #6366f1; font-size: 18px; }
          .slider-container { position: relative; height: 40px; }
          .slider-track {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 100%;
            height: 6px;
            background: linear-gradient(to right, #6366f1 70%, #e2e8f0 70%);
            border-radius: 3px;
          }
          .slider-thumb {
            position: absolute;
            top: 50%;
            left: 70%;
            transform: translate(-50%, -50%);
            width: 20px;
            height: 20px;
            background: white;
            border: 3px solid #6366f1;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .score-labels { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-top: 8px; }
          .comment-box {
            width: 100%;
            min-height: 120px;
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            resize: vertical;
            font-family: inherit;
          }
          .submit-btn {
            width: 100%;
            padding: 14px;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            margin-top: 16px;
          }
          .ai-suggest {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #f59e0b;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
          }
          .ai-header { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #92400e; margin-bottom: 8px; font-size: 14px; }
          .ai-text { font-size: 13px; color: #78350f; line-height: 1.5; }
        </style>
      </head>
      <body>
        <nav class="navbar">
          <div class="nav-logo">◆ OpenHackathon</div>
          <div class="nav-user">
            <span>👤 Alice Chen</span>
            <span>▼</span>
          </div>
        </nav>
        <div class="container">
          <div class="back-link">← Back to Judging Queue</div>
          <div class="project-header">
            <h1 class="project-title">SmartDoc Assistant</h1>
            <p class="project-tagline">AI-powered medical documentation for busy doctors</p>
            <div class="project-meta">
              <span class="meta-item">👤 Dave Builder</span>
              <span class="meta-item">🔗 GitHub</span>
              <span class="meta-item">🌐 Demo</span>
              <span class="tag">Healthcare</span>
              <span class="tag">AI</span>
              <span class="tag">Productivity</span>
            </div>
          </div>
          <div class="two-column">
            <div class="card">
              <div class="card-header">
                <span>Project Description</span>
                <span style="color: #6366f1; font-size: 13px;">View Repository →</span>
              </div>
              <div class="card-content">
                <p style="color: #475569; line-height: 1.7; font-size: 14px;">
                  SmartDoc listens to patient consultations and automatically generates structured medical notes, prescriptions, and follow-up recommendations. It integrates with existing EHR systems and ensures HIPAA compliance.
                </p>
                <div style="margin-top: 24px; padding: 20px; background: #f8fafc; border-radius: 8px;">
                  <h4 style="font-size: 14px; color: #1e293b; margin-bottom: 12px;">Key Features</h4>
                  <ul style="color: #475569; font-size: 14px; line-height: 1.8; padding-left: 18px;">
                    <li>Real-time speech-to-text transcription</li>
                    <li>Automatic medical note generation</li>
                    <li>EHR integration with major providers</li>
                    <li>HIPAA-compliant data handling</li>
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <div class="ai-suggest">
                <div class="ai-header">🤖 AI Suggestion</div>
                <div class="ai-text">Strong healthcare application with clear value proposition. Consider evaluating the technical feasibility of real-time processing.</div>
              </div>
              <div class="card">
                <div class="card-header">Scoring</div>
                <div class="card-content">
                  <div class="criterion">
                    <div class="criterion-header">
                      <span class="criterion-name">Innovation</span>
                      <span class="criterion-score">21/30</span>
                    </div>
                    <div class="slider-container">
                      <div class="slider-track"></div>
                      <div class="slider-thumb"></div>
                    </div>
                    <div class="score-labels">
                      <span>0</span>
                      <span>15</span>
                      <span>30</span>
                    </div>
                  </div>
                  <div class="criterion">
                    <div class="criterion-header">
                      <span class="criterion-name">Technology</span>
                      <span class="criterion-score">25/30</span>
                    </div>
                    <div class="slider-container">
                      <div class="slider-track" style="background: linear-gradient(to right, #6366f1 83%, #e2e8f0 83%);"></div>
                      <div class="slider-thumb" style="left: 83%;"></div>
                    </div>
                    <div class="score-labels">
                      <span>0</span>
                      <span>15</span>
                      <span>30</span>
                    </div>
                  </div>
                  <div class="criterion">
                    <div class="criterion-header">
                      <span class="criterion-name">Design & UX</span>
                      <span class="criterion-score">16/20</span>
                    </div>
                    <div class="slider-container">
                      <div class="slider-track" style="background: linear-gradient(to right, #6366f1 80%, #e2e8f0 80%);"></div>
                      <div class="slider-thumb" style="left: 80%;"></div>
                    </div>
                    <div class="score-labels">
                      <span>0</span>
                      <span>10</span>
                      <span>20</span>
                    </div>
                  </div>
                  <div class="criterion">
                    <div class="criterion-header">
                      <span class="criterion-name">Completion</span>
                      <span class="criterion-score">17/20</span>
                    </div>
                    <div class="slider-container">
                      <div class="slider-track" style="background: linear-gradient(to right, #6366f1 85%, #e2e8f0 85%);"></div>
                      <div class="slider-thumb" style="left: 85%;"></div>
                    </div>
                    <div class="score-labels">
                      <span>0</span>
                      <span>10</span>
                      <span>20</span>
                    </div>
                  </div>
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-weight: 600; color: #1e293b;">Total Score</span>
                      <span style="font-size: 24px; font-weight: 700; color: #6366f1;">79/100</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="card" style="margin-top: 16px;">
                <div class="card-header">Feedback</div>
                <div class="card-content">
                  <textarea class="comment-box" placeholder="Enter your feedback for the team...">Excellent healthcare solution with strong AI integration. The real-time transcription feature is impressive.</textarea>
                  <button class="submit-btn">Submit Score</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    await captureScreenshot(page, 'judging', { wait: 500 });

    // 4. Leaderboard
    console.log('📷 Creating leaderboard...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%);
            min-height: 100vh;
            padding: 40px;
          }
          .container { max-width: 1000px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 40px; }
          .header h1 { font-size: 42px; font-weight: 800; color: white; margin-bottom: 8px; }
          .header p { color: #a5b4fc; font-size: 18px; }
          .podium {
            display: flex;
            justify-content: center;
            align-items: flex-end;
            gap: 24px;
            margin-bottom: 48px;
          }
          .podium-item {
            text-align: center;
            color: white;
          }
          .podium-rank {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: 700;
            margin: 0 auto 16px;
          }
          .rank-1 { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); box-shadow: 0 8px 32px rgba(251, 191, 36, 0.4); }
          .rank-2 { background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); box-shadow: 0 8px 32px rgba(148, 163, 184, 0.4); }
          .rank-3 { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); box-shadow: 0 8px 32px rgba(249, 115, 22, 0.4); }
          .podium-project { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
          .podium-score { font-size: 14px; opacity: 0.8; }
          .podium-bar {
            width: 140px;
            border-radius: 12px 12px 0 0;
            margin-top: 20px;
          }
          .bar-1 { height: 140px; background: linear-gradient(180deg, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.1) 100%); border: 2px solid #fbbf24; }
          .bar-2 { height: 100px; background: linear-gradient(180deg, rgba(148, 163, 184, 0.3) 0%, rgba(148, 163, 184, 0.1) 100%); border: 2px solid #94a3b8; }
          .bar-3 { height: 80px; background: linear-gradient(180deg, rgba(249, 115, 22, 0.3) 0%, rgba(249, 115, 22, 0.1) 100%); border: 2px solid #f97316; }
          .leaderboard-table {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            overflow: hidden;
          }
          .table-header {
            display: grid;
            grid-template-columns: 80px 1fr 120px 120px;
            padding: 16px 24px;
            background: rgba(255, 255, 255, 0.1);
            color: #a5b4fc;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .table-row {
            display: grid;
            grid-template-columns: 80px 1fr 120px 120px;
            padding: 20px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: white;
            align-items: center;
          }
          .table-row:last-child { border-bottom: none; }
          .rank-number {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
          }
          .rank-gold { background: #fbbf24; color: #92400e; }
          .rank-silver { background: #94a3b8; color: #475569; }
          .rank-bronze { background: #f97316; color: #7c2d12; }
          .rank-normal { background: rgba(255,255,255,0.1); color: white; }
          .project-info h4 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
          .project-info p { font-size: 13px; color: #a5b4fc; }
          .score { font-size: 20px; font-weight: 700; color: #fbbf24; }
          .judges { font-size: 14px; color: #a5b4fc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 Leaderboard</h1>
            <p>Global AI Challenge 2026 - Final Results</p>
          </div>
          <div class="podium">
            <div class="podium-item">
              <div class="podium-rank rank-2">2</div>
              <div class="podium-project">DAOGovernance</div>
              <div class="podium-score">92.5 points</div>
              <div class="podium-bar bar-2"></div>
            </div>
            <div class="podium-item">
              <div class="podium-rank rank-1">1</div>
              <div class="podium-project">CrossChain Bridge</div>
              <div class="podium-score">94.2 points</div>
              <div class="podium-bar bar-1"></div>
            </div>
            <div class="podium-item">
              <div class="podium-rank rank-3">3</div>
              <div class="podium-project">ThreatDetector AI</div>
              <div class="podium-score">91.8 points</div>
              <div class="podium-bar bar-3"></div>
            </div>
          </div>
          <div class="leaderboard-table">
            <div class="table-header">
              <div>Rank</div>
              <div>Project</div>
              <div>Score</div>
              <div>Judges</div>
            </div>
            <div class="table-row">
              <div><span class="rank-number rank-gold">1</span></div>
              <div class="project-info">
                <h4>CrossChain Bridge</h4>
                <p>Secure cross-chain asset transfers</p>
              </div>
              <div class="score">94.2</div>
              <div class="judges">5 judges</div>
            </div>
            <div class="table-row">
              <div><span class="rank-number rank-silver">2</span></div>
              <div class="project-info">
                <h4>DAOGovernance</h4>
                <p>Streamlined DAO proposal system</p>
              </div>
              <div class="score">92.5</div>
              <div class="judges">5 judges</div>
            </div>
            <div class="table-row">
              <div><span class="rank-number rank-bronze">3</span></div>
              <div class="project-info">
                <h4>ThreatDetector AI</h4>
                <p>AI-powered network threat detection</p>
              </div>
              <div class="score">91.8</div>
              <div class="judges">4 judges</div>
            </div>
            <div class="table-row">
              <div><span class="rank-number rank-normal">4</span></div>
              <div class="project-info">
                <h4>Web3Identity</h4>
                <p>Decentralized identity platform</p>
              </div>
              <div class="score">90.1</div>
              <div class="judges">5 judges</div>
            </div>
            <div class="table-row">
              <div><span class="rank-number rank-normal">5</span></div>
              <div class="project-info">
                <h4>CodeReviewer AI</h4>
                <p>Automated code review with security</p>
              </div>
              <div class="score">89.5</div>
              <div class="judges">4 judges</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    await captureScreenshot(page, 'leaderboard', { wait: 500 });

    // 5. Project Gallery
    console.log('📷 Creating project gallery...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            min-height: 100vh;
          }
          .navbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 32px;
            background: white;
            border-bottom: 1px solid #e2e8f0;
          }
          .nav-logo { font-size: 18px; font-weight: 700; color: #6366f1; }
          .nav-links { display: flex; gap: 24px; color: #64748b; font-size: 14px; }
          .container { max-width: 1200px; margin: 0 auto; padding: 32px; }
          .page-header { margin-bottom: 32px; }
          .page-header h1 { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
          .page-header p { color: #64748b; }
          .filters { display: flex; gap: 12px; margin-bottom: 24px; }
          .filter-btn {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            border: 1px solid #e2e8f0;
            background: white;
            color: #475569;
            cursor: pointer;
          }
          .filter-btn.active { background: #6366f1; color: white; border-color: #6366f1; }
          .projects-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          .project-card {
            background: white;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            transition: box-shadow 0.2s;
          }
          .project-card:hover { box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .project-image {
            height: 160px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 48px;
          }
          .project-content { padding: 20px; }
          .project-tags { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
          .project-tag {
            padding: 4px 10px;
            background: #eef2ff;
            color: #6366f1;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
          }
          .project-title { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
          .project-desc { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 16px; }
          .project-footer { display: flex; justify-content: space-between; align-items: center; }
          .project-author { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
          .author-avatar { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
          .project-score { font-size: 14px; font-weight: 600; color: #22c55e; }
        </style>
      </head>
      <body>
        <nav class="navbar">
          <div class="nav-logo">◆ OpenHackathon</div>
          <div class="nav-links">
            <span>Home</span>
            <span style="color: #6366f1; font-weight: 500;">Projects</span>
            <span>Leaderboard</span>
            <span>Docs</span>
          </div>
        </nav>
        <div class="container">
          <div class="page-header">
            <h1>Submitted Projects</h1>
            <p>42 projects from Global AI Challenge 2026</p>
          </div>
          <div class="filters">
            <button class="filter-btn active">All Projects</button>
            <button class="filter-btn">Healthcare</button>
            <button class="filter-btn">AI/ML</button>
            <button class="filter-btn">DevTools</button>
            <button class="filter-btn">Education</button>
          </div>
          <div class="projects-grid">
            <div class="project-card">
              <div class="project-image">🏥</div>
              <div class="project-content">
                <div class="project-tags">
                  <span class="project-tag">Healthcare</span>
                  <span class="project-tag">AI</span>
                </div>
                <h3 class="project-title">SmartDoc Assistant</h3>
                <p class="project-desc">AI-powered medical documentation for busy doctors</p>
                <div class="project-footer">
                  <div class="project-author">
                    <div class="author-avatar"></div>
                    <span>Dave Builder</span>
                  </div>
                  <span class="project-score">89.0 pts</span>
                </div>
              </div>
            </div>
            <div class="project-card">
              <div class="project-image" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">💻</div>
              <div class="project-content">
                <div class="project-tags">
                  <span class="project-tag">DevTools</span>
                  <span class="project-tag">AI</span>
                </div>
                <h3 class="project-title">CodeGenie</h3>
                <p class="project-desc">Figma designs to React code instantly</p>
                <div class="project-footer">
                  <div class="project-author">
                    <div class="author-avatar" style="background: linear-gradient(135deg, #10b981, #059669);"></div>
                    <span>Eve Coder</span>
                  </div>
                  <span class="project-score">93.0 pts</span>
                </div>
              </div>
            </div>
            <div class="project-card">
              <div class="project-image" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">⚖️</div>
              <div class="project-content">
                <div class="project-tags">
                  <span class="project-tag">Legal</span>
                  <span class="project-tag">SaaS</span>
                </div>
                <h3 class="project-title">LegalEagle</h3>
                <p class="project-desc">Automated contract review and risk analysis</p>
                <div class="project-footer">
                  <div class="project-author">
                    <div class="author-avatar" style="background: linear-gradient(135deg, #f59e0b, #d97706);"></div>
                    <span>Frank Founder</span>
                  </div>
                  <span class="project-score">76.0 pts</span>
                </div>
              </div>
            </div>
            <div class="project-card">
              <div class="project-image" style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);">🎙️</div>
              <div class="project-content">
                <div class="project-tags">
                  <span class="project-tag">Audio</span>
                  <span class="project-tag">Creator</span>
                </div>
                <h3 class="project-title">VoiceClone</h3>
                <p class="project-desc">Real-time voice changing for content creators</p>
                <div class="project-footer">
                  <div class="project-author">
                    <div class="author-avatar" style="background: linear-gradient(135deg, #ec4899, #db2777);"></div>
                    <span>Alex Creator</span>
                  </div>
                  <span class="project-score">86.0 pts</span>
                </div>
              </div>
            </div>
            <div class="project-card">
              <div class="project-image" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);">🤖</div>
              <div class="project-content">
                <div class="project-tags">
                  <span class="project-tag">Productivity</span>
                  <span class="project-tag">SaaS</span>
                </div>
                <h3 class="project-title">MeetingMind</h3>
                <p class="project-desc">AI meeting assistant with action items</p>
                <div class="project-footer">
                  <div class="project-author">
                    <div class="author-avatar" style="background: linear-gradient(135deg, #06b6d4, #0891b2);"></div>
                    <span>Sam Organizer</span>
                  </div>
                  <span class="project-score">88.5 pts</span>
                </div>
              </div>
            </div>
            <div class="project-card">
              <div class="project-image" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">🔒</div>
              <div class="project-content">
                <div class="project-tags">
                  <span class="project-tag">Security</span>
                  <span class="project-tag">DevTools</span>
                </div>
                <h3 class="project-title">CodeReviewer AI</h3>
                <p class="project-desc">Automated code review with vulnerability detection</p>
                <div class="project-footer">
                  <div class="project-author">
                    <div class="author-avatar" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);"></div>
                    <span>DevAssist Team</span>
                  </div>
                  <span class="project-score">91.2 pts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    await captureScreenshot(page, 'projects', { wait: 500 });

    // 6. Hackathon Settings
    console.log('📷 Creating hackathon settings...');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            min-height: 100vh;
          }
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 260px;
            height: 100vh;
            background: white;
            border-right: 1px solid #e2e8f0;
            padding: 24px;
          }
          .sidebar-logo { font-size: 20px; font-weight: 700; color: #6366f1; margin-bottom: 32px; display: flex; align-items: center; gap: 8px; }
          .nav-item {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 4px;
            color: #64748b;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .nav-item.active { background: #eef2ff; color: #6366f1; font-weight: 500; }
          .main {
            margin-left: 260px;
            padding: 32px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }
          .header h1 { font-size: 24px; font-weight: 700; color: #1e293b; }
          .save-btn {
            padding: 10px 20px;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
          }
          .settings-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 24px;
          }
          .card {
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
          }
          .card-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
            color: #1e293b;
          }
          .card-content { padding: 24px; }
          .form-group { margin-bottom: 20px; }
          .form-group:last-child { margin-bottom: 0; }
          .form-label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px; }
          .form-input, .form-textarea, .form-select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
          }
          .form-textarea { min-height: 100px; resize: vertical; }
          .form-hint { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .criteria-list { display: flex; flex-direction: column; gap: 12px; }
          .criteria-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .criteria-info h4 { font-size: 14px; font-weight: 500; color: #1f2937; }
          .criteria-info p { font-size: 12px; color: #6b7280; }
          .criteria-score { font-weight: 600; color: #6366f1; }
          .add-btn {
            width: 100%;
            padding: 12px;
            background: white;
            border: 1px dashed #d1d5db;
            border-radius: 8px;
            color: #6b7280;
            font-size: 14px;
            cursor: pointer;
            margin-top: 12px;
          }
          .status-badge {
            display: inline-flex;
            padding: 6px 12px;
            background: #dcfce7;
            color: #166534;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <aside class="sidebar">
          <div class="sidebar-logo">◆ OpenHackathon</div>
          <div class="nav-item">📊 Dashboard</div>
          <div class="nav-item active">🏆 Hackathons</div>
          <div class="nav-item">📁 Projects</div>
          <div class="nav-item">⚖️ Judging</div>
          <div class="nav-item">📋 Assignments</div>
          <div class="nav-item">🏅 Leaderboard</div>
          <div class="nav-item">📈 Reports</div>
          <div class="nav-item">⚙️ Settings</div>
        </aside>
        <main class="main">
          <div class="header">
            <div>
              <h1>Edit Hackathon</h1>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Global AI Challenge 2026 <span class="status-badge" style="margin-left: 8px;">Active</span></p>
            </div>
            <button class="save-btn">💾 Save Changes</button>
          </div>
          <div class="settings-grid">
            <div>
              <div class="card" style="margin-bottom: 24px;">
                <div class="card-header">Basic Information</div>
                <div class="card-content">
                  <div class="form-group">
                    <label class="form-label">Hackathon Name</label>
                    <input type="text" class="form-input" value="Global AI Challenge 2026">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tagline</label>
                    <input type="text" class="form-input" value="Redefining the future with Generative AI">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea">Join the world's largest AI hackathon and build the future of generative AI applications.</textarea>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Start Date</label>
                      <input type="text" class="form-input" value="2026-03-15">
                    </div>
                    <div class="form-group">
                      <label class="form-label">End Date</label>
                      <input type="text" class="form-input" value="2026-03-17">
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Location</label>
                    <input type="text" class="form-input" value="San Francisco + Virtual">
                  </div>
                </div>
              </div>
              <div class="card">
                <div class="card-header">Scoring Criteria</div>
                <div class="card-content">
                  <div class="criteria-list">
                    <div class="criteria-item">
                      <div class="criteria-info">
                        <h4>Innovation</h4>
                        <p>Novelty and creativity of the solution</p>
                      </div>
                      <span class="criteria-score">30 pts</span>
                    </div>
                    <div class="criteria-item">
                      <div class="criteria-info">
                        <h4>Technology</h4>
                        <p>Technical complexity and implementation</p>
                      </div>
                      <span class="criteria-score">30 pts</span>
                    </div>
                    <div class="criteria-item">
                      <div class="criteria-info">
                        <h4>Design & UX</h4>
                        <p>User experience and visual design</p>
                      </div>
                      <span class="criteria-score">20 pts</span>
                    </div>
                    <div class="criteria-item">
                      <div class="criteria-info">
                        <h4>Completion</h4>
                        <p>Project completeness and polish</p>
                      </div>
                      <span class="criteria-score">20 pts</span>
                    </div>
                  </div>
                  <button class="add-btn">+ Add Criterion</button>
                </div>
              </div>
            </div>
            <div>
              <div class="card" style="margin-bottom: 24px;">
                <div class="card-header">Status</div>
                <div class="card-content">
                  <select class="form-select">
                    <option>🟢 Active</option>
                    <option>🟡 Upcoming</option>
                    <option>🔴 Draft</option>
                    <option>⚫ Completed</option>
                  </select>
                  <p class="form-hint">Active hackathons are visible to the public</p>
                </div>
              </div>
              <div class="card" style="margin-bottom: 24px;">
                <div class="card-header">Branding</div>
                <div class="card-content">
                  <div class="form-group">
                    <label class="form-label">Cover Gradient</label>
                    <input type="text" class="form-input" value="from-violet-600 via-fuchsia-500 to-indigo-600">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Prize Pool</label>
                    <input type="text" class="form-input" value="$50,000+">
                  </div>
                </div>
              </div>
              <div class="card">
                <div class="card-header">Danger Zone</div>
                <div class="card-content">
                  <button style="width: 100%; padding: 10px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 8px; font-size: 14px; cursor: pointer;">🗑️ Delete Hackathon</button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
      </html>
    `);
    await captureScreenshot(page, 'settings', { wait: 500 });

    console.log('\n✨ All screenshots generated!');
    console.log(`📁 Location: ${assetsDir}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
