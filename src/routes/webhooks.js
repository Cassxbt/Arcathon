/**
 * PayVoice - Webhook Routes
 * ElevenLabs agent tool endpoints for voice-activated payments
 */

import express from 'express';
import * as circleService from '../services/circle.js';
import * as dbService from '../services/db.js';

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
 * POST /api/balance
 * Get user's USDC balance
 * Input: { phone: string }
 * Output: { balance: string, currency: "USDC" }
 */
router.post('/balance', async (req, res) => {
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
 * Send USDC to a contact
 * Input: { phone: string, recipientName: string, amount: string }
 * Output: { success: boolean, txId: string, newBalance: string }
 */
router.post('/send', async (req, res) => {
  try {
    const { phone, recipientName, amount } = req.body;

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

    // Execute transfer via Circle
    const txResult = await circleService.sendUSDC(
      sender.wallet_id,
      contact.wallet_address,
      amount
    );

    // Record transaction in database
    await dbService.logTransaction(
      sender.id,
      'send',
      amountNum,
      recipientName,
      txResult.txId,
      'completed'
    );

    // Get new balance
    const newBalance = await circleService.getBalance(sender.wallet_id);

    console.log(`[Send] Transfer complete. TxId: ${txResult.txId}, New balance: ${newBalance} USDC`);

    res.json({
      success: true,
      txId: txResult.txId,
      newBalance: newBalance
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
 */
router.post('/history', async (req, res) => {
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
router.post('/contacts', async (req, res) => {
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
router.post('/contacts/add', async (req, res) => {
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

export default router;
