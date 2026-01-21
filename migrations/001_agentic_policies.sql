-- ============================================
-- PayVoice Agentic Commerce Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PILLAR 2: POLICIES
-- ============================================

-- User policies table
CREATE TABLE IF NOT EXISTS user_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  auto_approve_limit DECIMAL(10,2) DEFAULT 5.00,
  daily_spending_limit DECIMAL(10,2) DEFAULT 100.00,
  weekly_spending_limit DECIMAL(10,2) DEFAULT 500.00,
  low_balance_alert_threshold DECIMAL(10,2) DEFAULT 10.00,
  auto_save_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trusted contacts table
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  auto_approve_limit DECIMAL(10,2) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- ============================================
-- PILLAR 3: GUARDRAILS - Enhanced Transactions
-- ============================================

-- Add columns to transactions if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'tx_hash') THEN
    ALTER TABLE transactions ADD COLUMN tx_hash VARCHAR(66);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'block_height') THEN
    ALTER TABLE transactions ADD COLUMN block_height INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'was_auto_approved') THEN
    ALTER TABLE transactions ADD COLUMN was_auto_approved BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Alerts table for proactive notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PILLAR 4: TREASURY - Spending Tracking
-- ============================================

-- Daily spending aggregates (for fast budget checks)
CREATE TABLE IF NOT EXISTS daily_spending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_spent DECIMAL(10,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_wallet_id ON users(wallet_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user ON trusted_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_spending_user_date ON daily_spending(user_id, date DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get or create user policy
CREATE OR REPLACE FUNCTION get_or_create_user_policy(p_user_id UUID)
RETURNS user_policies AS $$
DECLARE
  policy user_policies;
BEGIN
  SELECT * INTO policy FROM user_policies WHERE user_id = p_user_id;

  IF policy IS NULL THEN
    INSERT INTO user_policies (user_id) VALUES (p_user_id)
    RETURNING * INTO policy;
  END IF;

  RETURN policy;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily spending
CREATE OR REPLACE FUNCTION update_daily_spending(p_user_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_spending (user_id, date, total_spent, transaction_count)
  VALUES (p_user_id, CURRENT_DATE, p_amount, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_spent = daily_spending.total_spent + p_amount,
    transaction_count = daily_spending.transaction_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get today's spending
CREATE OR REPLACE FUNCTION get_today_spending(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  spent DECIMAL;
BEGIN
  SELECT COALESCE(total_spent, 0) INTO spent
  FROM daily_spending
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN COALESCE(spent, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get this week's spending
CREATE OR REPLACE FUNCTION get_week_spending(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  spent DECIMAL;
BEGIN
  SELECT COALESCE(SUM(total_spent), 0) INTO spent
  FROM daily_spending
  WHERE user_id = p_user_id
    AND date >= DATE_TRUNC('week', CURRENT_DATE);

  RETURN spent;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- ============================================

ALTER TABLE user_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_spending ENABLE ROW LEVEL SECURITY;

-- Policies for service role (our backend uses service role key)
CREATE POLICY "Service role full access on user_policies" ON user_policies FOR ALL USING (true);
CREATE POLICY "Service role full access on trusted_contacts" ON trusted_contacts FOR ALL USING (true);
CREATE POLICY "Service role full access on alerts" ON alerts FOR ALL USING (true);
CREATE POLICY "Service role full access on daily_spending" ON daily_spending FOR ALL USING (true);

-- ============================================
-- DONE!
-- ============================================
SELECT 'Migration completed successfully!' as status;
