/**
 * PayVoice Policy Service
 * Handles the 4 Pillars of Agentic Commerce:
 * - IDENTITY: User verification
 * - POLICIES: Auto-approve rules, trusted contacts
 * - GUARDRAILS: Budget limits, alerts
 * - TREASURY: Spending tracking, analytics
 */

import { supabase } from './db.js';

// ============================================
// PILLAR 2: POLICIES
// ============================================

/**
 * Get user's policy settings (creates default if not exists)
 */
export async function getUserPolicy(userId) {
  try {
    // Try to get existing policy
    let { data: policy, error } = await supabase
      .from('user_policies')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If no policy exists, create default
    if (error && error.code === 'PGRST116') {
      const { data: newPolicy, error: insertError } = await supabase
        .from('user_policies')
        .insert({ user_id: userId })
        .select()
        .single();

      if (insertError) throw insertError;
      return newPolicy;
    }

    if (error) throw error;
    return policy;
  } catch (error) {
    console.error('[Policy] Error getting user policy:', error);
    throw error;
  }
}

/**
 * Update user's policy settings
 */
export async function updateUserPolicy(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('user_policies')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    console.log(`[Policy] Updated policy for user ${userId}`);
    return data;
  } catch (error) {
    console.error('[Policy] Error updating policy:', error);
    throw error;
  }
}

/**
 * Check if a contact is trusted
 */
export async function isTrustedContact(userId, contactId) {
  try {
    const { data, error } = await supabase
      .from('trusted_contacts')
      .select('*, contacts(name)')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Policy] Error checking trusted contact:', error);
    return null;
  }
}

/**
 * Add a trusted contact
 */
export async function addTrustedContact(userId, contactId, autoApproveLimit = null) {
  try {
    const { data, error } = await supabase
      .from('trusted_contacts')
      .insert({
        user_id: userId,
        contact_id: contactId,
        auto_approve_limit: autoApproveLimit
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`[Policy] Added trusted contact ${contactId} for user ${userId}`);
    return data;
  } catch (error) {
    console.error('[Policy] Error adding trusted contact:', error);
    throw error;
  }
}

/**
 * Remove a trusted contact
 */
export async function removeTrustedContact(userId, contactId) {
  try {
    const { error } = await supabase
      .from('trusted_contacts')
      .delete()
      .eq('user_id', userId)
      .eq('contact_id', contactId);

    if (error) throw error;
    console.log(`[Policy] Removed trusted contact ${contactId} for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[Policy] Error removing trusted contact:', error);
    throw error;
  }
}

/**
 * Get all trusted contacts for a user
 */
export async function getTrustedContacts(userId) {
  try {
    const { data, error } = await supabase
      .from('trusted_contacts')
      .select('*, contacts(name, wallet_address)')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Policy] Error getting trusted contacts:', error);
    return [];
  }
}

// ============================================
// PILLAR 3: GUARDRAILS
// ============================================

/**
 * Check if a payment can be auto-approved based on policies
 * Returns: { canAutoApprove: boolean, reason: string, requiresConfirmation: boolean }
 */
export async function checkAutoApproval(userId, contactId, amount) {
  try {
    const amountNum = parseFloat(amount);

    // Get user policy
    const policy = await getUserPolicy(userId);

    // Check if contact is trusted
    const trustedContact = await isTrustedContact(userId, contactId);

    // Get today's spending
    const todaySpent = await getTodaySpending(userId);
    const weekSpent = await getWeekSpending(userId);

    // Decision logic
    const result = {
      canAutoApprove: false,
      requiresConfirmation: true,
      reason: '',
      budgetStatus: {
        todaySpent,
        weekSpent,
        dailyLimit: policy.daily_spending_limit,
        weeklyLimit: policy.weekly_spending_limit,
        remainingToday: policy.daily_spending_limit - todaySpent,
        remainingWeek: policy.weekly_spending_limit - weekSpent
      }
    };

    // Check 1: Would this exceed daily limit?
    if (todaySpent + amountNum > policy.daily_spending_limit) {
      result.reason = `This would exceed your daily limit of $${policy.daily_spending_limit}. You've spent $${todaySpent} today.`;
      result.budgetExceeded = 'daily';
      return result;
    }

    // Check 2: Would this exceed weekly limit?
    if (weekSpent + amountNum > policy.weekly_spending_limit) {
      result.reason = `This would exceed your weekly limit of $${policy.weekly_spending_limit}. You've spent $${weekSpent} this week.`;
      result.budgetExceeded = 'weekly';
      return result;
    }

    // Check 3: Is contact trusted?
    if (!trustedContact) {
      result.reason = 'This contact is not in your trusted list.';
      return result;
    }

    // Check 4: Is amount within auto-approve limit?
    const effectiveLimit = trustedContact.auto_approve_limit || policy.auto_approve_limit;

    if (amountNum <= effectiveLimit) {
      result.canAutoApprove = true;
      result.requiresConfirmation = false;
      result.reason = `Auto-approved: $${amount} is within your $${effectiveLimit} limit for trusted contacts.`;
      return result;
    }

    // Amount exceeds auto-approve limit but contact is trusted
    result.reason = `Amount $${amount} exceeds your auto-approve limit of $${effectiveLimit}.`;
    return result;

  } catch (error) {
    console.error('[Policy] Error checking auto-approval:', error);
    return {
      canAutoApprove: false,
      requiresConfirmation: true,
      reason: 'Could not verify policies. Please confirm manually.'
    };
  }
}

/**
 * Get today's total spending
 */
export async function getTodaySpending(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_spending')
      .select('total_spent')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (error && error.code === 'PGRST116') return 0;
    if (error) throw error;

    return parseFloat(data?.total_spent || 0);
  } catch (error) {
    console.error('[Policy] Error getting today spending:', error);
    return 0;
  }
}

/**
 * Get this week's total spending
 */
export async function getWeekSpending(userId) {
  try {
    // Get start of week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_spending')
      .select('total_spent')
      .eq('user_id', userId)
      .gte('date', weekStart);

    if (error) throw error;

    const total = (data || []).reduce((sum, d) => sum + parseFloat(d.total_spent || 0), 0);
    return total;
  } catch (error) {
    console.error('[Policy] Error getting week spending:', error);
    return 0;
  }
}

/**
 * Update daily spending after a transaction
 */
export async function updateDailySpending(userId, amount) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const amountNum = parseFloat(amount);

    // Upsert daily spending record
    const { data: existing } = await supabase
      .from('daily_spending')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      await supabase
        .from('daily_spending')
        .update({
          total_spent: parseFloat(existing.total_spent) + amountNum,
          transaction_count: existing.transaction_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('daily_spending')
        .insert({
          user_id: userId,
          date: today,
          total_spent: amountNum,
          transaction_count: 1
        });
    }

    console.log(`[Policy] Updated daily spending for user ${userId}: +$${amount}`);
  } catch (error) {
    console.error('[Policy] Error updating daily spending:', error);
  }
}

// ============================================
// PILLAR 3: ALERTS
// ============================================

/**
 * Create an alert for a user
 */
export async function createAlert(userId, alertType, title, message, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id: userId,
        alert_type: alertType,
        title,
        message,
        metadata
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`[Alert] Created ${alertType} alert for user ${userId}`);
    return data;
  } catch (error) {
    console.error('[Alert] Error creating alert:', error);
    throw error;
  }
}

/**
 * Check and create low balance alert if needed
 */
export async function checkLowBalanceAlert(userId, currentBalance) {
  try {
    const policy = await getUserPolicy(userId);
    const balance = parseFloat(currentBalance);
    const threshold = parseFloat(policy.low_balance_alert_threshold);

    if (balance <= threshold) {
      // Check if we already sent this alert today
      const today = new Date().toISOString().split('T')[0];

      const { data: existingAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('alert_type', 'low_balance')
        .gte('created_at', today)
        .single();

      if (!existingAlert) {
        return await createAlert(
          userId,
          'low_balance',
          'Low Balance Alert',
          `Your balance is $${balance.toFixed(2)}, which is below your alert threshold of $${threshold.toFixed(2)}. Consider topping up soon!`,
          { balance, threshold }
        );
      }
    }
    return null;
  } catch (error) {
    console.error('[Alert] Error checking low balance:', error);
    return null;
  }
}

/**
 * Get unread alerts for a user
 */
export async function getUnreadAlerts(userId) {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Alert] Error getting unread alerts:', error);
    return [];
  }
}

/**
 * Mark alerts as read
 */
export async function markAlertsAsRead(userId, alertIds = null) {
  try {
    let query = supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (alertIds && alertIds.length > 0) {
      query = query.in('id', alertIds);
    }

    await query;
    console.log(`[Alert] Marked alerts as read for user ${userId}`);
  } catch (error) {
    console.error('[Alert] Error marking alerts as read:', error);
  }
}

// ============================================
// PILLAR 4: TREASURY / ANALYTICS
// ============================================

/**
 * Get spending summary for a user
 */
export async function getSpendingSummary(userId, days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily spending data
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_spending')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (dailyError) throw dailyError;

    // Get transaction breakdown by recipient
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('amount, recipient_name, created_at')
      .eq('user_id', userId)
      .eq('type', 'send')
      .gte('created_at', startDate.toISOString())
      .order('amount', { ascending: false });

    if (txError) throw txError;

    // Calculate totals
    const totalSpent = (dailyData || []).reduce((sum, d) => sum + parseFloat(d.total_spent || 0), 0);
    const totalTransactions = (dailyData || []).reduce((sum, d) => sum + (d.transaction_count || 0), 0);

    // Group by recipient
    const byRecipient = {};
    (txData || []).forEach(tx => {
      const name = tx.recipient_name || 'Unknown';
      if (!byRecipient[name]) {
        byRecipient[name] = { total: 0, count: 0 };
      }
      byRecipient[name].total += parseFloat(tx.amount);
      byRecipient[name].count += 1;
    });

    // Sort recipients by amount
    const topRecipients = Object.entries(byRecipient)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        percentage: totalSpent > 0 ? Math.round((data.total / totalSpent) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Get policy for budget context
    const policy = await getUserPolicy(userId);
    const todaySpent = await getTodaySpending(userId);
    const weekSpent = await getWeekSpending(userId);

    return {
      period: `Last ${days} days`,
      totalSpent: totalSpent.toFixed(2),
      totalTransactions,
      averagePerTransaction: totalTransactions > 0 ? (totalSpent / totalTransactions).toFixed(2) : '0.00',
      topRecipients,
      budget: {
        daily: {
          limit: policy.daily_spending_limit,
          spent: todaySpent,
          remaining: Math.max(0, policy.daily_spending_limit - todaySpent),
          percentUsed: Math.round((todaySpent / policy.daily_spending_limit) * 100)
        },
        weekly: {
          limit: policy.weekly_spending_limit,
          spent: weekSpent,
          remaining: Math.max(0, policy.weekly_spending_limit - weekSpent),
          percentUsed: Math.round((weekSpent / policy.weekly_spending_limit) * 100)
        }
      },
      dailyBreakdown: dailyData || []
    };
  } catch (error) {
    console.error('[Treasury] Error getting spending summary:', error);
    throw error;
  }
}

export default {
  // Policies
  getUserPolicy,
  updateUserPolicy,
  isTrustedContact,
  addTrustedContact,
  removeTrustedContact,
  getTrustedContacts,
  // Guardrails
  checkAutoApproval,
  getTodaySpending,
  getWeekSpending,
  updateDailySpending,
  // Alerts
  createAlert,
  checkLowBalanceAlert,
  getUnreadAlerts,
  markAlertsAsRead,
  // Treasury
  getSpendingSummary
};
