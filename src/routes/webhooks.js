/**
 * PayVoice - Webhook Routes
 * ElevenLabs agent tool endpoints for voice-activated payments
 *
 * AGENTIC FEATURES:
 * - IDENTITY: Wallet-based verification
 * - POLICIES: Auto-approve, trusted contacts, spending limits
 * - GUARDRAILS: Budget enforcement, alerts, txHash confirmation
 * - TREASURY: Spending analytics, balance management
 */

import express from 'express';
import * as circleService from '../services/circle.js';
import * as dbService from '../services/db.js';
import * as policyService from '../services/policy.js';
import {
  authenticateToolRequest,
  rateLimitByPhone,
  validateTransactionLimits
} from '../middleware/auth.js';

const router = express.Router();

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {Array<string>} requiredFields - List of required field names
 * @returns {Object} - { valid: boolean, missing: Array<string> }
 */
function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field]);
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * POST /api/verify
 * PILLAR 1: IDENTITY - Verify user identity
 * Can verify by phone + optional wallet address confirmation
 * Input: { phone: string, walletLast4?: string }
 * Output: { verified: boolean, user: object }
 * Security: Bearer token required
 */
router.post('/verify', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, walletLast4 } = req.body;

    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    console.log(`[Verify] Identity check for phone: ${phone}`);

    const user = await dbService.getUserByPhone(phone);

    if (!user) {
      return res.json({
        verified: false,
        reason: 'No account found for this phone number',
        isNewUser: true
      });
    }

    // If wallet verification requested
    if (walletLast4 && user.wallet_address) {
      const actualLast4 = user.wallet_address.slice(-4).toLowerCase();
      if (walletLast4.toLowerCase() !== actualLast4) {
        console.log(`[Verify] Wallet verification failed for ${phone}`);
        return res.json({
          verified: false,
          reason: 'Wallet address does not match',
          isNewUser: false
        });
      }
    }

    // Get policy for context
    const policy = await policyService.getUserPolicy(user.id);

    // Get any unread alerts
    const alerts = await policyService.getUnreadAlerts(user.id);

    console.log(`[Verify] Identity verified for ${user.name || phone}`);

    res.json({
      verified: true,
      user: {
        name: user.name || 'User',
        hasWallet: !!user.wallet_id,
        walletLast4: user.wallet_address ? user.wallet_address.slice(-4) : null
      },
      policy: {
        autoApproveLimit: policy.auto_approve_limit,
        dailyLimit: policy.daily_spending_limit
      },
      pendingAlerts: alerts.length,
      isNewUser: false
    });
  } catch (error) {
    console.error(`[Verify Error] ${error.message}`);
    res.status(500).json({
      error: 'Verification failed',
      message: error.message
    });
  }
});

/**
 * POST /api/conversation-init
 * ElevenLabs Conversation Initiation Webhook
 * Called when a new conversation starts to fetch user context
 * Input: { caller_id: string, agent_id: string, called_number?: string, call_sid?: string }
 * Output: { type: "conversation_initiation_client_data", dynamic_variables: {...} }
 */
router.post('/conversation-init', async (req, res) => {
  try {
    const { caller_id, agent_id } = req.body;

    console.log(`[Conversation Init] New conversation from: ${caller_id}, agent: ${agent_id}`);

    // Normalize phone number (remove + and any spaces/dashes)
    const normalizedPhone = caller_id ? caller_id.replace(/[\s\-\+]/g, '') : null;

    // Default response for unknown users
    let dynamicVariables = {
      user_name: 'there',
      account_balance: '0.00',
      recent_transaction: 'No recent transactions',
      is_new_user: 'true'
    };

    if (normalizedPhone) {
      // Try to find user by phone
      const user = await dbService.getUserByPhone(normalizedPhone);

      if (user) {
        dynamicVariables.user_name = user.name || 'there';
        dynamicVariables.is_new_user = 'false';

        // Get balance if user has wallet
        if (user.wallet_id) {
          try {
            const balance = await circleService.getBalance(user.wallet_id);
            dynamicVariables.account_balance = balance || '0.00';
          } catch (balanceError) {
            console.error(`[Conversation Init] Failed to fetch balance: ${balanceError.message}`);
            dynamicVariables.account_balance = 'unavailable';
          }
        }

        // Get most recent transaction
        try {
          const transactions = await dbService.getRecentTransactions(user.id, 1);
          if (transactions && transactions.length > 0) {
            const tx = transactions[0];
            const txDate = new Date(tx.created_at).toLocaleDateString();
            dynamicVariables.recent_transaction = `${tx.type === 'send' ? 'Sent' : 'Received'} $${tx.amount} ${tx.type === 'send' ? 'to' : 'from'} ${tx.recipient_name} on ${txDate}`;
          }
        } catch (txError) {
          console.error(`[Conversation Init] Failed to fetch transactions: ${txError.message}`);
        }

        console.log(`[Conversation Init] Found user: ${user.name}, balance: ${dynamicVariables.account_balance}`);
      } else {
        console.log(`[Conversation Init] New user, phone: ${normalizedPhone}`);
      }
    }

    // Return ElevenLabs conversation initiation format
    res.json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: dynamicVariables
    });

  } catch (error) {
    console.error(`[Conversation Init Error] ${error.message}`);
    // Still return a valid response so conversation can proceed
    res.json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        user_name: 'there',
        account_balance: '0.00',
        recent_transaction: 'No recent transactions',
        is_new_user: 'true'
      }
    });
  }
});

/**
 * POST /api/post-call
 * ElevenLabs Post-Call Webhook
 * Receives conversation data after each call ends
 * Used for logging, analytics, and debugging
 */
router.post('/post-call', async (req, res) => {
  try {
    const { type, event_timestamp, data } = req.body;

    console.log(`[Post-Call Webhook] Received ${type} event`);

    if (type === 'post_call_transcription' && data) {
      const {
        agent_id,
        conversation_id,
        status,
        transcript,
        metadata,
        analysis
      } = data;

      // Log conversation summary
      console.log(`[Post-Call] Conversation ID: ${conversation_id}`);
      console.log(`[Post-Call] Status: ${status}`);
      console.log(`[Post-Call] Duration: ${metadata?.call_duration_secs || 'N/A'} seconds`);

      // Log transcript summary
      if (transcript && transcript.length > 0) {
        console.log(`[Post-Call] Transcript turns: ${transcript.length}`);

        // Log first and last messages for quick overview
        const firstMsg = transcript[0];
        const lastMsg = transcript[transcript.length - 1];
        console.log(`[Post-Call] First: [${firstMsg?.role}] ${firstMsg?.message?.substring(0, 100)}...`);
        console.log(`[Post-Call] Last: [${lastMsg?.role}] ${lastMsg?.message?.substring(0, 100)}...`);
      }

      // Log analysis if available
      if (analysis) {
        console.log(`[Post-Call] Call successful: ${analysis.call_successful}`);
        if (analysis.transcript_summary) {
          console.log(`[Post-Call] Summary: ${analysis.transcript_summary}`);
        }
      }

      // Store in database for later review (optional enhancement)
      // await dbService.logConversation(conversation_id, data);
    }

    if (type === 'post_call_audio') {
      console.log(`[Post-Call] Audio received for conversation: ${data?.conversation_id}`);
      // Audio is base64 encoded MP3 - could store for playback
    }

    // Must return 200 for ElevenLabs to consider webhook successful
    res.status(200).json({ received: true });

  } catch (error) {
    console.error(`[Post-Call Webhook Error] ${error.message}`);
    // Still return 200 to acknowledge receipt
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * POST /api/balance
 * Get user's USDC balance
 * Input: { phone: string }
 * Output: { balance: string, currency: "USDC" }
 * Security: Bearer token required, rate limited
 */
router.post('/balance', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate required fields
    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    console.log(`[Balance] Fetching balance for phone: ${phone}`);

    // Get user from database
    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    if (!user.wallet_id) {
      return res.status(400).json({
        error: 'No wallet',
        message: 'User does not have a wallet yet'
      });
    }

    // Get balance from Circle
    const balance = await circleService.getBalance(user.wallet_id);

    console.log(`[Balance] Retrieved balance: ${balance} USDC for phone: ${phone}`);

    res.json({
      balance: balance,
      currency: 'USDC'
    });
  } catch (error) {
    console.error(`[Balance Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to fetch balance',
      message: error.message
    });
  }
});

/**
 * POST /api/send
 * Send USDC to a contact with AGENTIC features
 * Input: { phone: string, recipientName: string, amount: string, confirmed?: boolean }
 * Output: { success: boolean, txHash: string, newBalance: string, autoApproved: boolean, ... }
 *
 * AGENTIC FEATURES:
 * - Auto-approve for trusted contacts under limit
 * - Budget enforcement (daily/weekly limits)
 * - Returns blockchain txHash for verification
 * - Updates spending analytics
 * - Checks for low balance alerts
 *
 * Security: Bearer token required, rate limited, transaction limits enforced
 */
router.post('/send', authenticateToolRequest, rateLimitByPhone, validateTransactionLimits, async (req, res) => {
  try {
    const { phone, recipientName, amount, confirmed = false } = req.body;

    // Validate required fields
    const validation = validateRequiredFields(req.body, ['phone', 'recipientName', 'amount']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a positive number'
      });
    }

    console.log(`[Send] Processing transfer: ${amount} USDC from ${phone} to ${recipientName}`);

    // Get sender from database
    const sender = await dbService.getUserByPhone(phone);
    if (!sender) {
      return res.status(404).json({
        error: 'Sender not found',
        message: 'No account found for this phone number'
      });
    }

    if (!sender.wallet_id) {
      return res.status(400).json({
        error: 'No wallet',
        message: 'Sender does not have a wallet yet'
      });
    }

    // Get recipient contact
    const contact = await dbService.getContactByName(sender.id, recipientName);
    if (!contact) {
      return res.status(404).json({
        error: 'Contact not found',
        message: `No contact named "${recipientName}" found in your contacts`
      });
    }

    // Check sender has sufficient balance
    const currentBalance = await circleService.getBalance(sender.wallet_id);
    if (parseFloat(currentBalance) < amountNum) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `Your balance (${currentBalance} USDC) is less than the transfer amount (${amount} USDC)`
      });
    }

    // ============================================
    // PILLAR 2 & 3: POLICY CHECK & GUARDRAILS
    // ============================================
    const approvalCheck = await policyService.checkAutoApproval(sender.id, contact.id, amount);

    // If budget would be exceeded, block the transaction
    if (approvalCheck.budgetExceeded) {
      console.log(`[Send] BLOCKED: Budget exceeded - ${approvalCheck.reason}`);
      return res.status(400).json({
        error: 'Budget limit exceeded',
        message: approvalCheck.reason,
        budgetStatus: approvalCheck.budgetStatus,
        requiresConfirmation: false,
        blocked: true
      });
    }

    // If confirmation is required and not yet confirmed
    if (approvalCheck.requiresConfirmation && !confirmed) {
      console.log(`[Send] Requires confirmation: ${approvalCheck.reason}`);
      return res.json({
        success: false,
        requiresConfirmation: true,
        reason: approvalCheck.reason,
        budgetStatus: approvalCheck.budgetStatus,
        message: `Please confirm: Send $${amount} USDC to ${recipientName}?`
      });
    }

    const wasAutoApproved = approvalCheck.canAutoApprove;
    if (wasAutoApproved) {
      console.log(`[Send] AUTO-APPROVED: ${approvalCheck.reason}`);
    }

    // ============================================
    // EXECUTE TRANSFER WITH CONFIRMATION
    // ============================================
    console.log(`[Send] Executing transfer with confirmation polling...`);

    const txResult = await circleService.sendUSDCWithConfirmation(
      sender.wallet_id,
      contact.wallet_address,
      amount
    );

    if (!txResult.success) {
      console.error(`[Send] Transaction failed: ${txResult.errorReason}`);

      // Log failed transaction
      await dbService.logTransactionWithDetails({
        userId: sender.id,
        type: 'send',
        amount: amountNum,
        recipientName,
        circleTxId: txResult.transactionId,
        status: 'failed',
        wasAutoApproved
      });

      return res.status(500).json({
        error: 'Transaction failed',
        message: txResult.errorReason || 'The transaction could not be completed',
        transactionId: txResult.transactionId,
        state: txResult.state
      });
    }

    // ============================================
    // PILLAR 4: TREASURY - Update spending
    // ============================================
    await policyService.updateDailySpending(sender.id, amountNum);

    // Log successful transaction with full details
    await dbService.logTransactionWithDetails({
      userId: sender.id,
      type: 'send',
      amount: amountNum,
      recipientName,
      circleTxId: txResult.transactionId,
      status: 'completed',
      txHash: txResult.txHash,
      blockHeight: txResult.blockHeight,
      wasAutoApproved
    });

    // Get new balance
    const newBalance = await circleService.getBalance(sender.wallet_id);

    // Check for low balance alert
    const lowBalanceAlert = await policyService.checkLowBalanceAlert(sender.id, newBalance);

    console.log(`[Send] Transfer complete! TxHash: ${txResult.txHash}, New balance: ${newBalance} USDC`);

    // ============================================
    // RETURN COMPREHENSIVE RESPONSE
    // ============================================
    res.json({
      success: true,
      autoApproved: wasAutoApproved,
      transactionId: txResult.transactionId,
      txHash: txResult.txHash,
      blockHeight: txResult.blockHeight,
      state: txResult.state,
      amount: amount,
      recipient: recipientName,
      newBalance: newBalance,
      confirmedAt: txResult.firstConfirmDate,
      // Include budget status for agent context
      budgetStatus: {
        dailyRemaining: approvalCheck.budgetStatus.remainingToday - amountNum,
        weeklyRemaining: approvalCheck.budgetStatus.remainingWeek - amountNum
      },
      // Alert if balance is low
      lowBalanceWarning: lowBalanceAlert ? lowBalanceAlert.message : null
    });

  } catch (error) {
    console.error(`[Send Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to send USDC',
      message: error.message
    });
  }
});

/**
 * POST /api/history
 * Get recent transactions
 * Input: { phone: string, limit?: number }
 * Output: { transactions: Array<{type, amount, recipient, date}> }
 * Security: Bearer token required, rate limited
 */
router.post('/history', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, limit = 5 } = req.body;

    // Validate required fields
    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    console.log(`[History] Fetching ${limit} transactions for phone: ${phone}`);

    // Get user from database
    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    // Get transaction history from database
    const transactions = await dbService.getRecentTransactions(user.id, limit);

    console.log(`[History] Retrieved ${transactions.length} transactions for phone: ${phone}`);

    res.json({
      transactions: transactions.map(tx => ({
        type: tx.type,
        amount: tx.amount,
        recipient: tx.recipient_name,
        date: tx.created_at,
        status: tx.status
      }))
    });
  } catch (error) {
    console.error(`[History Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to fetch transaction history',
      message: error.message
    });
  }
});

/**
 * POST /api/contacts
 * List user's contacts
 * Input: { phone: string }
 * Output: { contacts: Array<{name, walletAddress}> }
 */
router.post('/contacts', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone } = req.body;

    // Validate required fields
    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    console.log(`[Contacts] Fetching contacts for phone: ${phone}`);

    // Get user from database
    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    // Get contacts
    const contacts = await dbService.getContacts(user.id);

    console.log(`[Contacts] Retrieved ${contacts.length} contacts for phone: ${phone}`);

    res.json({
      contacts: contacts.map(contact => ({
        name: contact.name,
        walletAddress: contact.wallet_address
      }))
    });
  } catch (error) {
    console.error(`[Contacts Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to fetch contacts',
      message: error.message
    });
  }
});

/**
 * POST /api/contacts/add
 * Add a new contact
 * Input: { phone: string, name: string, walletAddress: string }
 * Output: { success: boolean, contact: object }
 */
router.post('/contacts/add', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, name, walletAddress } = req.body;

    // Validate required fields
    const validation = validateRequiredFields(req.body, ['phone', 'name', 'walletAddress']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    // Validate wallet address format (basic check for Ethereum-style address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        error: 'Invalid wallet address',
        message: 'Wallet address must be a valid Ethereum address (0x followed by 40 hex characters)'
      });
    }

    console.log(`[Contacts/Add] Adding contact "${name}" for phone: ${phone}`);

    // Get user from database
    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    // Check if contact name already exists
    const existingContact = await dbService.getContactByName(user.id, name);
    if (existingContact) {
      return res.status(400).json({
        error: 'Contact already exists',
        message: `A contact named "${name}" already exists`
      });
    }

    // Add contact
    const newContact = await dbService.addContact(user.id, name, walletAddress);

    console.log(`[Contacts/Add] Contact "${name}" added successfully for phone: ${phone}`);

    res.json({
      success: true,
      contact: {
        name: newContact.name,
        walletAddress: newContact.wallet_address
      }
    });
  } catch (error) {
    console.error(`[Contacts/Add Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to add contact',
      message: error.message
    });
  }
});

/**
 * POST /api/policy
 * Get or update user's policy settings
 * Input: { phone: string, updates?: object }
 * Output: { policy: object }
 * Security: Bearer token required
 */
router.post('/policy', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, updates } = req.body;

    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    let policy;
    if (updates && Object.keys(updates).length > 0) {
      // Validate update fields
      const allowedFields = [
        'auto_approve_limit',
        'daily_spending_limit',
        'weekly_spending_limit',
        'low_balance_alert_threshold'
      ];
      const sanitizedUpdates = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          sanitizedUpdates[key] = parseFloat(updates[key]);
        }
      }
      policy = await policyService.updateUserPolicy(user.id, sanitizedUpdates);
      console.log(`[Policy] Updated policy for ${phone}`);
    } else {
      policy = await policyService.getUserPolicy(user.id);
    }

    res.json({
      policy: {
        autoApproveLimit: policy.auto_approve_limit,
        dailySpendingLimit: policy.daily_spending_limit,
        weeklySpendingLimit: policy.weekly_spending_limit,
        lowBalanceAlertThreshold: policy.low_balance_alert_threshold
      }
    });
  } catch (error) {
    console.error(`[Policy Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to get/update policy',
      message: error.message
    });
  }
});

/**
 * POST /api/policy/trusted
 * Manage trusted contacts
 * Input: { phone: string, action: 'list'|'add'|'remove', contactName?: string, autoApproveLimit?: number }
 * Output: { trustedContacts: array } or { success: boolean }
 */
router.post('/policy/trusted', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, action = 'list', contactName, autoApproveLimit } = req.body;

    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    if (action === 'list') {
      const trusted = await policyService.getTrustedContacts(user.id);
      return res.json({
        trustedContacts: trusted.map(tc => ({
          name: tc.contacts?.name,
          autoApproveLimit: tc.auto_approve_limit,
          addedAt: tc.created_at
        }))
      });
    }

    if (action === 'add') {
      if (!contactName) {
        return res.status(400).json({
          error: 'Missing contact name',
          message: 'Please specify which contact to add as trusted'
        });
      }

      const contact = await dbService.getContactByName(user.id, contactName);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: `No contact named "${contactName}" found`
        });
      }

      await policyService.addTrustedContact(
        user.id,
        contact.id,
        autoApproveLimit ? parseFloat(autoApproveLimit) : null
      );

      console.log(`[Policy] Added trusted contact ${contactName} for ${phone}`);
      return res.json({
        success: true,
        message: `${contactName} is now a trusted contact${autoApproveLimit ? ` with $${autoApproveLimit} auto-approve limit` : ''}`
      });
    }

    if (action === 'remove') {
      if (!contactName) {
        return res.status(400).json({
          error: 'Missing contact name',
          message: 'Please specify which contact to remove from trusted'
        });
      }

      const contact = await dbService.getContactByName(user.id, contactName);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: `No contact named "${contactName}" found`
        });
      }

      await policyService.removeTrustedContact(user.id, contact.id);
      console.log(`[Policy] Removed trusted contact ${contactName} for ${phone}`);
      return res.json({
        success: true,
        message: `${contactName} is no longer a trusted contact`
      });
    }

    res.status(400).json({
      error: 'Invalid action',
      message: 'Action must be "list", "add", or "remove"'
    });
  } catch (error) {
    console.error(`[Policy/Trusted Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to manage trusted contacts',
      message: error.message
    });
  }
});

/**
 * POST /api/spending
 * Get spending summary and analytics (PILLAR 4: TREASURY)
 * Input: { phone: string, days?: number }
 * Output: { summary: object with spending analytics }
 */
router.post('/spending', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, days = 7 } = req.body;

    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    const summary = await policyService.getSpendingSummary(user.id, Math.min(days, 30));

    console.log(`[Spending] Retrieved ${days}-day summary for ${phone}`);

    res.json({ summary });
  } catch (error) {
    console.error(`[Spending Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to get spending summary',
      message: error.message
    });
  }
});

/**
 * POST /api/alerts
 * Get user's unread alerts
 * Input: { phone: string, markAsRead?: boolean }
 * Output: { alerts: array }
 */
router.post('/alerts', authenticateToolRequest, rateLimitByPhone, async (req, res) => {
  try {
    const { phone, markAsRead = false } = req.body;

    const validation = validateRequiredFields(req.body, ['phone']);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing: validation.missing
      });
    }

    const user = await dbService.getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this phone number'
      });
    }

    const alerts = await policyService.getUnreadAlerts(user.id);

    if (markAsRead && alerts.length > 0) {
      await policyService.markAlertsAsRead(user.id);
    }

    res.json({
      alerts: alerts.map(a => ({
        type: a.alert_type,
        title: a.title,
        message: a.message,
        createdAt: a.created_at
      }))
    });
  } catch (error) {
    console.error(`[Alerts Error] ${error.message}`);
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error.message
    });
  }
});

/**
 * POST /api/circle-webhook
 * Circle webhook endpoint for transaction notifications
 * Handles: transactions.inbound (deposits) and transactions.outbound (sends)
 * This enables proactive notifications when funds are received
 */
router.post('/circle-webhook', async (req, res) => {
  try {
    const { subscriptionId, notificationId, notificationType, notification } = req.body;

    console.log(`[Circle Webhook] Received ${notificationType} notification`);

    // Handle inbound transactions (deposits/receives)
    if (notificationType === 'transactions.inbound') {
      const { transaction } = notification;

      if (transaction.state === 'COMPLETE') {
        // Find user by wallet ID
        const user = await dbService.getUserByWalletId(transaction.walletId);

        if (user) {
          // Find USDC amount
          const usdcAmount = transaction.amounts?.find(a =>
            a.token?.symbol === 'USDC'
          );

          const amount = usdcAmount?.amount || '0';

          console.log(`[Circle Webhook] User ${user.phone} received ${amount} USDC`);

          // Log the incoming transaction
          await dbService.logTransactionWithDetails({
            userId: user.id,
            type: 'receive',
            amount: parseFloat(amount),
            recipientName: 'External',
            circleTxId: transaction.id,
            status: 'completed',
            txHash: transaction.txHash,
            blockHeight: transaction.blockHeight,
            wasAutoApproved: false
          });

          // Create alert for user
          await policyService.createAlert(
            user.id,
            'deposit_received',
            'Funds Received!',
            `You received ${amount} USDC. Your new balance is ready to use.`,
            {
              txHash: transaction.txHash,
              amount,
              from: transaction.sourceAddress
            }
          );

          // TODO: Send text notification via ElevenLabs when implemented
        }
      }
    }

    // Handle outbound transaction updates (for status changes)
    if (notificationType === 'transactions.outbound') {
      const { transaction } = notification;

      if (transaction.state === 'COMPLETE' || transaction.state === 'FAILED') {
        // Update transaction record with final status
        await dbService.updateTransactionDetails(transaction.id, {
          status: transaction.state === 'COMPLETE' ? 'completed' : 'failed',
          tx_hash: transaction.txHash,
          block_height: transaction.blockHeight
        });
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error(`[Circle Webhook Error] ${error.message}`);
    // Still return 200 to prevent retries
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;
