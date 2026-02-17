-- 1. Fix Users Table (Link to Supabase Auth)
-- Drop password_hash as it is handled by auth.users
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Ensure users table references auth.users
-- Note: Changing PK type/reference on existing table is tricky if data exists.
-- Assuming clean slate or compatible UUIDs. If id is not a foreign key to auth.users, we should fix it.
-- For now, we assume the initial migration created users with UUIDs that match auth.users (if any).
-- If not, we might need to recreate the table or just add a foreign key constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_id_fkey' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Add SaaS Tables (Multi-tenancy)

-- Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
  default_language VARCHAR(10) DEFAULT 'zh-CN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  limits JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  payment_method JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing Records Table
CREATE TABLE IF NOT EXISTS billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  type VARCHAR(50) NOT NULL CHECK (type IN ('subscription', 'usage', 'overage')),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CNY' CHECK (currency IN ('CNY', 'USD')),
  usage JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translations Table
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL CHECK (language IN ('zh-CN', 'en-US', 'zh-TW', 'ja-JP', 'ko-KR')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[],
  prizes JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hackathon_id, language)
);

-- 3. Add Tenant ID to Existing Tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hackathons_tenant ON hackathons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_tenant ON billing_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_translations_hackathon ON translations(hackathon_id);

-- 5. Enable RLS on New Tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for New Tables

-- Tenants Policies
CREATE POLICY "Tenants visible to members" ON tenants FOR SELECT USING (
  id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);

-- Subscriptions Policies
CREATE POLICY "Subscriptions visible to tenant admins" ON subscriptions FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('organizer', 'super_admin'))
);

-- Billing Records Policies
CREATE POLICY "Billing records visible to tenant admins" ON billing_records FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('organizer', 'super_admin'))
);

-- Translations Policies
CREATE POLICY "Translations visible to everyone" ON translations FOR SELECT USING (true);
CREATE POLICY "Translations editable by organizers" ON translations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM hackathons h
    WHERE h.id = hackathon_id AND (h.organizer_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
    )
  )
);

-- 7. Sync Profile Trigger (Handle new user signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), 'participant');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger only if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 8. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON translations TO authenticated;
GRANT SELECT ON tenants TO anon;
GRANT SELECT ON translations TO anon;
