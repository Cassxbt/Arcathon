/**
 * Circle SDK Service for PayVoice
 *
 * This module provides wallet management and USDC transfer functionality
 * using Circle's Developer-Controlled Wallets SDK.
 *
 * @requires @circle-fin/developer-controlled-wallets@9.2.0
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

// Target blockchain for all operations
export const BLOCKCHAIN = 'ARC-TESTNET';

// Circle client instance (singleton)
let client = null;

/**
 * Initialize the Circle Developer-Controlled Wallets client.
 * Uses environment variables for API key and entity secret.
 *
 * @returns {Object} The initialized Circle client instance
 * @throws {Error} If required environment variables are missing
 */
export function initializeClient() {
  try {
    if (client) {
      return client;
    }

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey) {
      throw new Error('CIRCLE_API_KEY environment variable is not set');
    }

    if (!entitySecret) {
      throw new Error('CIRCLE_ENTITY_SECRET environment variable is not set');
    }

    client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    console.log('Circle client initialized successfully');
    return client;
  } catch (error) {
    console.error('Failed to initialize Circle client:', error.message);
    throw error;
  }
}

/**
 * Create a new wallet set (container for wallets).
 * This is typically a one-time setup operation.
 *
 * @param {string} name - The name for the wallet set
 * @returns {Promise<Object>} The created wallet set details
 * @throws {Error} If wallet set creation fails
 */
export async function createWalletSet(name) {
  try {
    const circleClient = initializeClient();

    const response = await circleClient.createWalletSet({
      name,
    });

    if (!response.data?.walletSet) {
      throw new Error('Failed to create wallet set: No data returned');
    }

    console.log('Wallet set created:', response.data.walletSet.id);
    return response.data.walletSet;
  } catch (error) {
    console.error('Error creating wallet set:', error.message);
    throw new Error(`Failed to create wallet set: ${error.message}`);
  }
}

/**
 * Create a new wallet on the Arc testnet blockchain for a user.
 *
 * @param {string} walletSetId - The ID of the wallet set to create the wallet in
 * @param {string} name - The name/identifier for the wallet (e.g., user's phone number)
 * @returns {Promise<Object>} The created wallet details including address and ID
 * @throws {Error} If wallet creation fails
 */
export async function createWallet(walletSetId, name) {
  try {
    const circleClient = initializeClient();

    const response = await circleClient.createWallets({
      blockchains: [BLOCKCHAIN],
      count: 1,
      walletSetId,
      metadata: [{ name }],
    });

    if (!response.data?.wallets || response.data.wallets.length === 0) {
      throw new Error('Failed to create wallet: No wallet data returned');
    }

    const wallet = response.data.wallets[0];
    console.log('Wallet created:', wallet.id, 'Address:', wallet.address);
    return wallet;
  } catch (error) {
    console.error('Error creating wallet:', error.message);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
}

/**
 * Get the USDC balance for a wallet.
 *
 * @param {string} walletId - The ID of the wallet to check balance for
 * @returns {Promise<Object>} Balance information including token balances
 * @throws {Error} If balance retrieval fails
 */
export async function getWalletBalance(walletId) {
  try {
    const circleClient = initializeClient();

    const response = await circleClient.getWalletTokenBalance({
      id: walletId,
    });

    const tokenBalances = response.data?.tokenBalances || [];

    // Find USDC balance specifically
    const usdcBalance = tokenBalances.find(
      (token) => token.token?.symbol === 'USDC' || token.token?.name?.includes('USDC')
    );

    return {
      tokenBalances,
      usdcBalance: usdcBalance?.amount || '0',
      usdcToken: usdcBalance?.token || null,
    };
  } catch (error) {
    console.error('Error getting wallet balance:', error.message);
    throw new Error(`Failed to get wallet balance: ${error.message}`);
  }
}

/**
 * Transfer USDC from one wallet to another wallet address.
 *
 * @param {string} fromWalletId - The ID of the source wallet
 * @param {string} toWalletAddress - The destination wallet blockchain address
 * @param {string} amount - The amount of USDC to transfer (e.g., "10" for 10 USDC)
 * @returns {Promise<Object>} Transaction details including ID and state
 * @throws {Error} If transfer fails or insufficient balance
 */
export async function transferUSDC(fromWalletId, toWalletAddress, amount) {
  try {
    const circleClient = initializeClient();

    // First, get the wallet's token balance to find the USDC token ID
    const balanceResponse = await circleClient.getWalletTokenBalance({
      id: fromWalletId,
    });

    const tokenBalances = balanceResponse.data?.tokenBalances || [];
    const usdcToken = tokenBalances.find(
      (token) => token.token?.symbol === 'USDC' || token.token?.name?.includes('USDC')
    );

    if (!usdcToken?.token?.id) {
      throw new Error('USDC token not found in wallet. Ensure the wallet has USDC tokens.');
    }

    // Check if there's sufficient balance
    const currentBalance = parseFloat(usdcToken.amount || '0');
    const transferAmount = parseFloat(amount);

    if (currentBalance < transferAmount) {
      throw new Error(`Insufficient USDC balance. Available: ${currentBalance}, Requested: ${transferAmount}`);
    }

    // Create the transfer transaction
    const response = await circleClient.createTransaction({
      walletId: fromWalletId,
      tokenId: usdcToken.token.id,
      destinationAddress: toWalletAddress,
      amount: [amount],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
    });

    if (!response.data) {
      throw new Error('Failed to create transfer: No transaction data returned');
    }

    console.log('Transfer initiated:', response.data.id, 'State:', response.data.state);
    return {
      transactionId: response.data.id,
      state: response.data.state,
    };
  } catch (error) {
    console.error('Error transferring USDC:', error.message);
    throw new Error(`Failed to transfer USDC: ${error.message}`);
  }
}

/**
 * Get transaction history for a wallet.
 *
 * @param {string} walletId - The ID of the wallet to get transaction history for
 * @param {number} [limit=5] - Maximum number of transactions to return
 * @returns {Promise<Array>} Array of transaction objects
 * @throws {Error} If transaction history retrieval fails
 */
export async function getTransactionHistory(walletId, limit = 5) {
  try {
    const circleClient = initializeClient();

    const response = await circleClient.listTransactions({
      walletIds: [walletId],
      pageSize: limit,
    });

    const transactions = response.data?.transactions || [];

    // Format transactions for easier consumption
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.transactionType,
      operation: tx.operation,
      state: tx.state,
      amounts: tx.amounts,
      sourceAddress: tx.sourceAddress,
      destinationAddress: tx.destinationAddress,
      txHash: tx.txHash,
      networkFee: tx.networkFee,
      createDate: tx.createDate,
      updateDate: tx.updateDate,
      errorReason: tx.errorReason,
    }));

    return formattedTransactions;
  } catch (error) {
    console.error('Error getting transaction history:', error.message);
    throw new Error(`Failed to get transaction history: ${error.message}`);
  }
}

/**
 * Get a wallet by its unique identifier.
 *
 * @param {string} walletId - The ID of the wallet to retrieve
 * @returns {Promise<Object>} The wallet details
 * @throws {Error} If wallet retrieval fails
 */
export async function getWallet(walletId) {
  try {
    const circleClient = initializeClient();

    const response = await circleClient.getWallet({
      id: walletId,
    });

    if (!response.data?.wallet) {
      throw new Error('Wallet not found');
    }

    return response.data.wallet;
  } catch (error) {
    console.error('Error getting wallet:', error.message);
    throw new Error(`Failed to get wallet: ${error.message}`);
  }
}

/**
 * Request testnet tokens for a wallet (useful for testing).
 *
 * @param {string} walletAddress - The blockchain address of the wallet
 * @returns {Promise<void>}
 * @throws {Error} If token request fails
 */
export async function requestTestnetTokens(walletAddress) {
  try {
    const circleClient = initializeClient();

    await circleClient.requestTestnetTokens({
      address: walletAddress,
      blockchain: BLOCKCHAIN,
      usdc: true,
      native: true,
    });

    console.log('Testnet tokens requested for:', walletAddress);
  } catch (error) {
    console.error('Error requesting testnet tokens:', error.message);
    throw new Error(`Failed to request testnet tokens: ${error.message}`);
  }
}

/**
 * Get a transaction by its unique identifier.
 *
 * @param {string} transactionId - The ID of the transaction to retrieve
 * @returns {Promise<Object>} The transaction details
 * @throws {Error} If transaction retrieval fails
 */
export async function getTransaction(transactionId) {
  try {
    const circleClient = initializeClient();

    const response = await circleClient.getTransaction({
      id: transactionId,
    });

    if (!response.data?.transaction) {
      throw new Error('Transaction not found');
    }

    return response.data.transaction;
  } catch (error) {
    console.error('Error getting transaction:', error.message);
    throw new Error(`Failed to get transaction: ${error.message}`);
  }
}

/**
 * Simplified getBalance function for webhook routes
 */
export async function getBalance(walletId) {
  const result = await getWalletBalance(walletId);
  return result.usdcBalance;
}

/**
 * Simplified sendUSDC function for webhook routes
 */
export async function sendUSDC(fromWalletId, toWalletAddress, amount) {
  const result = await transferUSDC(fromWalletId, toWalletAddress, amount);
  return { txId: result.transactionId };
}
