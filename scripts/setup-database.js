/**
 * Script to set up Supabase database tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n=== SETTING UP DATABASE ===\n');
console.log('Supabase URL:', supabaseUrl);

// Test connection by trying to query
async function testConnection() {
  try {
    // Try to query the users table (will fail if it doesn't exist, which is expected)
    const { data, error } = await supabase.from('users').select('count').limit(1);

    if (error && error.code === '42P01') {
      console.log('ℹ️  Tables do not exist yet - this is expected for first-time setup');
      console.log('\n⚠️  You need to run the SQL schema manually in Supabase SQL Editor.');
      console.log('\nPlease go to: https://supabase.com/dashboard (go to SQL Editor)');
      console.log('And paste the SQL schema from: supabase-schema.sql\n');
      return false;
    } else if (error) {
      console.log('Connection error:', error.message);
      return false;
    } else {
      console.log('✅ Tables already exist!');
      return true;
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
    return false;
  }
}

// Check if we can insert a test user
async function verifyTables() {
  console.log('\nVerifying table structure...');

  // Check users table
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (usersError) {
    console.log('❌ Users table issue:', usersError.message);
    return false;
  }
  console.log('✅ Users table OK');

  // Check contacts table
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .limit(1);

  if (contactsError) {
    console.log('❌ Contacts table issue:', contactsError.message);
    return false;
  }
  console.log('✅ Contacts table OK');

  // Check transactions table
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .limit(1);

  if (txError) {
    console.log('❌ Transactions table issue:', txError.message);
    return false;
  }
  console.log('✅ Transactions table OK');

  console.log('\n✅ All tables verified successfully!\n');
  return true;
}

async function main() {
  const connected = await testConnection();
  if (connected) {
    await verifyTables();
  }
}

main();
