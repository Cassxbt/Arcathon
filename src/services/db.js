/**
 * PayVoice Database Service
 * Supabase database operations for user management, contacts, and transactions
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get or create a user by phone number
 * If user doesn't exist, creates a new user record (wallet to be added later)
 * @param {string} phone - The user's phone number
 * @returns {Promise<Object>} The user object
 * @throws {Error} If database operation fails
 */
export async function getOrCreateUser(phone) {
  try {
    // First, try to get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return existingUser;
    }

    // If user doesn't exist (PGRST116 = no rows returned), create new user
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        phone,
        daily_limit: 500,
        language: 'en'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error(`Failed to get or create user: ${error.message}`);
  }
}

/**
 * Get user by phone number
 * @param {string} phone - The user's phone number
 * @returns {Promise<Object|null>} The user object or null if not found
 * @throws {Error} If database operation fails
 */
export async function getUserByPhone(phone) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getUserByPhone:', error);
    throw new Error(`Failed to get user by phone: ${error.message}`);
  }
}

/**
 * Update user's wallet information
 * @param {string} phone - The user's phone number
 * @param {string} walletId - The Circle wallet ID
 * @param {string} walletAddress - The wallet blockchain address
 * @returns {Promise<Object>} The updated user object
 * @throws {Error} If database operation fails
 */
export async function updateUserWallet(phone, walletId, walletAddress) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        wallet_id: walletId,
        wallet_address: walletAddress,
        updated_at: new Date().toISOString()
      })
      .eq('phone', phone)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserWallet:', error);
    throw new Error(`Failed to update user wallet: ${error.message}`);
  }
}

/**
 * Get all contacts for a user
 * @param {string} userId - The user's UUID
 * @returns {Promise<Array>} Array of contact objects
 * @throws {Error} If database operation fails
 */
export async function getContacts(userId) {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getContacts:', error);
    throw new Error(`Failed to get contacts: ${error.message}`);
  }
}

/**
 * Get a contact by name for a specific user
 * @param {string} userId - The user's UUID
 * @param {string} name - The contact's name (case-insensitive search)
 * @returns {Promise<Object|null>} The contact object or null if not found
 * @throws {Error} If database operation fails
 */
export async function getContactByName(userId, name) {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', name)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getContactByName:', error);
    throw new Error(`Failed to get contact by name: ${error.message}`);
  }
}

/**
 * Add a new contact for a user
 * @param {string} userId - The user's UUID
 * @param {string} name - The contact's name
 * @param {string} walletAddress - The contact's wallet address
 * @returns {Promise<Object>} The created contact object
 * @throws {Error} If database operation fails or contact already exists
 */
export async function addContact(userId, name, walletAddress) {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        name,
        wallet_address: walletAddress
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`Contact with name "${name}" already exists`);
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in addContact:', error);
    throw new Error(`Failed to add contact: ${error.message}`);
  }
}

/**
 * Log a transaction (cached from Circle)
 * @param {string} userId - The user's UUID
 * @param {string} type - Transaction type ('send' or 'receive')
 * @param {number} amount - Transaction amount
 * @param {string} recipientName - Name of the recipient
 * @param {string} circleTxId - Circle transaction ID
 * @param {string} status - Transaction status ('pending', 'completed', 'failed')
 * @returns {Promise<Object>} The created transaction record
 * @throws {Error} If database operation fails
 */
export async function logTransaction(userId, type, amount, recipientName, circleTxId, status) {
  try {
    // Validate transaction type
    if (!['send', 'receive'].includes(type)) {
      throw new Error('Invalid transaction type. Must be "send" or "receive"');
    }

    // Validate status
    if (!['pending', 'completed', 'failed'].includes(status)) {
      throw new Error('Invalid status. Must be "pending", "completed", or "failed"');
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type,
        amount,
        recipient_name: recipientName,
        circle_tx_id: circleTxId,
        status
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in logTransaction:', error);
    throw new Error(`Failed to log transaction: ${error.message}`);
  }
}

/**
 * Get recent transactions for a user
 * @param {string} userId - The user's UUID
 * @param {number} limit - Maximum number of transactions to return (default: 5)
 * @returns {Promise<Array>} Array of transaction objects, ordered by most recent first
 * @throws {Error} If database operation fails
 */
export async function getRecentTransactions(userId, limit = 5) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecentTransactions:', error);
    throw new Error(`Failed to get recent transactions: ${error.message}`);
  }
}

// Export the Supabase client for advanced use cases
export { supabase };
