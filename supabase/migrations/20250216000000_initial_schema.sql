
-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('participant', 'organizer', 'judge', 'super_admin')),
  organization VARCHAR(255),
  skills TEXT[],
  metadata JSONB DEFAULT '{}',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(32),
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 黑客松活动表
CREATE TABLE hackathons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'judging', 'completed')),
  max_team_size INTEGER DEFAULT 4,
  settings JSONB DEFAULT '{}',
  organizer_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 报名表
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  team_id UUID,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  additional_info JSONB DEFAULT '{}',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, hackathon_id)
);

-- 团队表
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  leader_id UUID NOT NULL REFERENCES users(id),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 团队成员表
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  tech_stack TEXT[],
  demo_url TEXT,
  repository_url TEXT,
  video_url TEXT,
  vote_count INTEGER DEFAULT 0,
  average_score DECIMAL(3,2) DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 评审表
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  comments TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, reviewer_id)
);

-- 投票表
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  voter_email VARCHAR(255),
  ip_address INET,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 奖项表
CREATE TABLE prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position INTEGER,
  prize_type VARCHAR(50),
  metadata JSONB DEFAULT '{}'
);

-- Session表
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('preliminary', 'semi_final', 'final')),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'judging', 'completed')),
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE projects
  ADD CONSTRAINT projects_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES sessions(id)
  ON DELETE CASCADE;

-- 项目分配表
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(judge_id, project_id)
);

-- 评委表
CREATE TABLE judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expertise TEXT[],
  experience TEXT,
  credentials TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI相关表
-- AI评委表
CREATE TABLE ai_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  persona_type VARCHAR(50) NOT NULL CHECK (persona_type IN ('tech', 'design', 'product', 'general')),
  capabilities JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI评委人格表
CREATE TABLE ai_judge_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_judge_id UUID NOT NULL REFERENCES ai_judges(id) ON DELETE CASCADE,
  persona_name VARCHAR(255) NOT NULL,
  description TEXT,
  scoring_criteria JSONB DEFAULT '{}',
  personality_traits JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI评审表
CREATE TABLE ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ai_judge_id UUID NOT NULL REFERENCES ai_judges(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  feedback TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  reasoning JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI评分表
CREATE TABLE ai_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_review_id UUID NOT NULL REFERENCES ai_reviews(id) ON DELETE CASCADE,
  criterion VARCHAR(50) NOT NULL,
  score DECIMAL(3,2) NOT NULL,
  justification TEXT,
  breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI匹配表
CREATE TABLE ai_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommended_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL,
  match_reasons JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, recommended_user_id, hackathon_id)
);

-- 生成内容表
CREATE TABLE generated_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 抄袭检测表
CREATE TABLE plagiarism_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  similarity_score DECIMAL(3,2) NOT NULL,
  detected_sources JSONB DEFAULT '{}',
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  recommendations JSONB DEFAULT '{}',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 内容审核表
CREATE TABLE content_moderations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_safe BOOLEAN NOT NULL,
  violations JSONB DEFAULT '{}',
  suggested_edits JSONB DEFAULT '{}',
  moderated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 向量嵌入表
CREATE TABLE vector_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content_id UUID NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_hackathons_status ON hackathons(status);
CREATE INDEX idx_hackathons_dates ON hackathons(start_date, end_date);
CREATE INDEX idx_registrations_user_hackathon ON registrations(user_id, hackathon_id);
CREATE INDEX idx_registrations_hackathon ON registrations(hackathon_id);
CREATE INDEX idx_teams_hackathon ON teams(hackathon_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_projects_hackathon ON projects(hackathon_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_vote_count ON projects(vote_count DESC);
CREATE INDEX idx_projects_average_score ON projects(average_score DESC);
CREATE INDEX idx_reviews_project ON reviews(project_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_votes_project ON votes(project_id);
CREATE INDEX idx_votes_user_date ON votes(user_id, voted_at);
CREATE INDEX idx_prizes_hackathon ON prizes(hackathon_id);

CREATE INDEX idx_sessions_hackathon ON sessions(hackathon_id);
CREATE INDEX idx_sessions_type ON sessions(type);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_assignments_judge ON assignments(judge_id);
CREATE INDEX idx_assignments_project ON assignments(project_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_judges_user ON judges(user_id);
CREATE INDEX idx_judges_status ON judges(status);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- AI相关索引
CREATE INDEX idx_ai_judges_persona ON ai_judges(persona_type);
CREATE INDEX idx_ai_judges_active ON ai_judges(is_active);
CREATE INDEX idx_ai_reviews_project ON ai_reviews(project_id);
CREATE INDEX idx_ai_reviews_judge ON ai_reviews(ai_judge_id);
CREATE INDEX idx_ai_scores_review ON ai_scores(ai_review_id);
CREATE INDEX idx_ai_matches_user ON ai_matches(user_id);
CREATE INDEX idx_ai_matches_hackathon ON ai_matches(hackathon_id);
CREATE INDEX idx_ai_matches_score ON ai_matches(match_score DESC);
CREATE INDEX idx_generated_contents_type ON generated_contents(content_type);
CREATE INDEX idx_plagiarism_checks_project ON plagiarism_checks(project_id);
CREATE INDEX idx_plagiarism_checks_score ON plagiarism_checks(similarity_score DESC);
CREATE INDEX idx_content_moderations_type ON content_moderations(content_type);
CREATE INDEX idx_vector_embeddings_type ON vector_embeddings(content_type);
CREATE INDEX idx_vector_embeddings_content ON vector_embeddings(content_id);
