/**
 * Run SQL on Supabase using the Management API
 */

// These should be set as environment variables in production
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'your-project-ref';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'your-access-token';

const sql = `
-- PayVoice Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    wallet_id TEXT,
    wallet_address TEXT,
    daily_limit NUMERIC DEFAULT 500,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_contact_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name_lower ON contacts(LOWER(name));

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('send', 'receive')),
    amount NUMERIC NOT NULL,
    recipient_name TEXT,
    circle_tx_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_circle_tx_id ON transactions(circle_tx_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies (drop first if exist, then create)
DROP POLICY IF EXISTS "Allow all for users" ON users;
DROP POLICY IF EXISTS "Allow all for contacts" ON contacts;
DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;

CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
`;

async function runSQL() {
  console.log('\n=== RUNNING SQL ON SUPABASE ===\n');
  console.log('Project:', PROJECT_REF);

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      console.log('\nTrying alternative method...');
      return await tryAlternativeMethod();
    }

    const result = await response.json();
    console.log('\n✅ SQL executed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function tryAlternativeMethod() {
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Alternative API Error:', response.status, errorText);
      console.log('\n📋 Please run the SQL manually:');
      console.log('1. Go to: https://supabase.com/dashboard (go to SQL Editor)');
      console.log('2. Paste the SQL from supabase-schema.sql');
      console.log('3. Click Run');
      return false;
    }

    const result = await response.json();
    console.log('\n✅ SQL executed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

runSQL();
