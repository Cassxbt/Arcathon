-- PayVoice Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- Stores user accounts with wallet information
-- ============================================
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

-- Index for phone lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Index for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- ============================================
-- CONTACTS TABLE
-- Stores user's saved contacts with wallet addresses
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique contact names per user
    CONSTRAINT unique_contact_per_user UNIQUE (user_id, name)
);

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- Index for name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_contacts_name_lower ON contacts(LOWER(name));

-- ============================================
-- TRANSACTIONS TABLE
-- Caches transaction records from Circle
-- ============================================
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

-- Index for user_id lookups with created_at for sorting
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Index for recent transactions query (user + date)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);

-- Index for Circle transaction ID lookups
CREATE INDEX IF NOT EXISTS idx_transactions_circle_tx_id ON transactions(circle_tx_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update users.updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable these for production security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for backend operations)
-- Note: The anon key will have access via these policies when using service role

-- Users table policies
CREATE POLICY "Service role can manage users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Contacts table policies
CREATE POLICY "Service role can manage contacts" ON contacts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Transactions table policies
CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- Uncomment to insert test data
-- ============================================

/*
-- Insert test user
INSERT INTO users (phone, wallet_id, wallet_address, daily_limit, language)
VALUES ('+1234567890', 'test-wallet-id', '0x1234567890abcdef', 500, 'en');

-- Get the test user's ID
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM users WHERE phone = '+1234567890';

    -- Insert test contacts
    INSERT INTO contacts (user_id, name, wallet_address)
    VALUES
        (test_user_id, 'Alice', '0xalice123'),
        (test_user_id, 'Bob', '0xbob456');

    -- Insert test transactions
    INSERT INTO transactions (user_id, type, amount, recipient_name, circle_tx_id, status)
    VALUES
        (test_user_id, 'send', 50.00, 'Alice', 'circle-tx-001', 'completed'),
        (test_user_id, 'receive', 100.00, 'Bob', 'circle-tx-002', 'completed'),
        (test_user_id, 'send', 25.00, 'Alice', 'circle-tx-003', 'pending');
END $$;
*/

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify schema is set up correctly
-- ============================================

/*
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('users', 'contacts', 'transactions');

-- Check indexes
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('users', 'contacts', 'transactions');

-- Check constraints
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace;
*/
