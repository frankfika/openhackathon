INSERT INTO users (id, email, password_hash, name, role, organization, skills, metadata)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'superadmin@demo.local', 'x', 'Super Admin', 'super_admin', 'OpenHackathon', ARRAY['ops','security'], '{"seed": true}'),
  ('22222222-2222-2222-2222-222222222222', 'organizer@demo.local', 'x', 'Organizer Demo', 'organizer', 'Demo Org', ARRAY['community','events'], '{"seed": true}'),
  ('33333333-3333-3333-3333-333333333333', 'judge@demo.local', 'x', 'Judge Demo', 'judge', 'Demo Org', ARRAY['product','ux'], '{"seed": true}'),
  ('44444444-4444-4444-4444-444444444444', 'dev@demo.local', 'x', 'Participant Dev', 'participant', NULL, ARRAY['frontend','ai'], '{"seed": true}'),
  ('55555555-5555-5555-5555-555555555555', 'design@demo.local', 'x', 'Participant Design', 'participant', NULL, ARRAY['design','motion'], '{"seed": true}');

INSERT INTO hackathons (id, title, description, start_date, end_date, status, max_team_size, organizer_id, settings)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Apple-Style AI Hackathon', 'Build human-first AI products in 48 hours.', '2026-03-15T09:00:00Z', '2026-03-17T09:00:00Z', 'active', 4, '22222222-2222-2222-2222-222222222222', '{"theme": "AI + UX"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Open Source Sprint', 'Ship meaningful OSS with mentors and judges.', '2026-04-09T09:00:00Z', '2026-04-12T09:00:00Z', 'upcoming', 5, '22222222-2222-2222-2222-222222222222', '{"theme": "OSS"}');

INSERT INTO sessions (id, name, type, hackathon_id, start_date, end_date, status, description, settings)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Preliminary', 'preliminary', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-03-15T09:00:00Z', '2026-03-16T09:00:00Z', 'active', 'Round 1', '{"rubric": {"innovation": 10, "execution": 10, "ux": 10}}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Final', 'final', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-03-16T09:00:00Z', '2026-03-17T09:00:00Z', 'draft', 'Final round', '{"rubric": {"impact": 10, "quality": 10, "demo": 10}}'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Preliminary', 'preliminary', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-04-09T09:00:00Z', '2026-04-10T09:00:00Z', 'draft', 'Round 1', '{"rubric": {"oss_value": 10, "maintainability": 10, "community": 10}}');

INSERT INTO teams (id, name, description, leader_id, hackathon_id, member_count)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'CyberPunk', 'Fast prototyping team', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2),
  ('f2222222-2222-2222-2222-222222222222', 'GlassMotion', 'Design-first builders', '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2);

INSERT INTO team_members (team_id, user_id, role)
VALUES
  ('f1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'leader'),
  ('f1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'member'),
  ('f2222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'leader'),
  ('f2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'member');

INSERT INTO projects (id, title, description, team_id, hackathon_id, session_id, tech_stack, demo_url, repository_url, vote_count, average_score)
VALUES
  ('61111111-1111-1111-1111-111111111111', 'Vision Notes', 'Turn screenshots into structured meeting notes with citations.', 'f1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', ARRAY['Vite','React','Supabase'], 'https://example.com/demo', 'https://github.com/example/vision-notes', 328, 8.70),
  ('62222222-2222-2222-2222-222222222222', 'JudgeOS', 'Confidential judging workspace with AI pre-scores.', 'f2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', ARRAY['Node','Postgres','RLS'], NULL, 'https://github.com/example/judge-os', 214, 8.20);

INSERT INTO judges (id, user_id, expertise, experience, status)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', ARRAY['Product','UX','Pitch'], '3 years judging experience', 'approved');

INSERT INTO ai_judges (id, name, persona_type, capabilities, is_active)
VALUES
  ('91111111-1111-1111-1111-111111111111', 'AI Judge · Tech', 'tech', '{"openai_compatible": true, "scoring": true}', true);

INSERT INTO assignments (id, judge_id, project_id, status)
VALUES
  ('81111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '61111111-1111-1111-1111-111111111111', 'in_progress'),
  ('82222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '62222222-2222-2222-2222-222222222222', 'pending');

INSERT INTO prizes (id, hackathon_id, name, description, position, prize_type)
VALUES
  ('71111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Best Product', 'Strong UX + clear value proposition', 1, 'category'),
  ('72222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Best Engineering', 'Solid architecture and execution', 2, 'category');
