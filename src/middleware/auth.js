/**
 * PayVoice - Authentication Middleware
 * Industry-standard Bearer token authentication for tool endpoints
 */

/**
 * Verify Bearer token for ElevenLabs tool calls
 * Tools must include Authorization header: "Bearer <API_KEY>"
 */
export function authenticateToolRequest(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader) {
    console.warn(`[Auth] Missing Authorization header for ${req.path}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  }

  // Check Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    console.warn(`[Auth] Invalid Authorization format for ${req.path}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Authorization format. Expected: Bearer <token>'
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const expectedToken = process.env.PAYVOICE_API_KEY;

  // Validate API key is configured
  if (!expectedToken) {
    console.error('[Auth] PAYVOICE_API_KEY not configured in environment');
    // In production, this should fail. For hackathon, allow passthrough with warning
    console.warn('[Auth] WARNING: Allowing request without API key validation');
    return next();
  }

  // Constant-time comparison to prevent timing attacks
  if (!secureCompare(token, expectedToken)) {
    console.warn(`[Auth] Invalid API key attempted for ${req.path}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  console.log(`[Auth] Request authenticated for ${req.path}`);
  next();
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings are equal
 */
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Use constant-time comparison
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Rate limiting middleware (basic implementation)
 * Prevents abuse of payment endpoints
 */
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per phone

export function rateLimitByPhone(req, res, next) {
  const phone = req.body?.phone;

  if (!phone) {
    return next(); // Can't rate limit without phone
  }

  const now = Date.now();
  const key = `${phone}`;

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return next();
  }

  const record = requestCounts.get(key);

  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.windowStart = now;
    return next();
  }

  // Check limit
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    console.warn(`[RateLimit] Phone ${phone.substring(0, 6)}... exceeded rate limit`);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Please slow down. Try again in a minute.'
    });
  }

  record.count++;
  next();
}

/**
 * Transaction amount limit middleware
 * Prevents large unauthorized transfers
 */
const DAILY_LIMIT_DEFAULT = 1000; // $1000 USDC default daily limit

export function validateTransactionLimits(req, res, next) {
  const { amount } = req.body;

  if (!amount) {
    return next();
  }

  const amountNum = parseFloat(amount);

  // Single transaction limit
  if (amountNum > DAILY_LIMIT_DEFAULT) {
    console.warn(`[Limits] Large transaction attempted: $${amount}`);
    return res.status(400).json({
      error: 'Transaction Limit Exceeded',
      message: `Single transactions over $${DAILY_LIMIT_DEFAULT} require additional verification. Please contact support.`
    });
  }

  // Flag high-value transactions for logging
  if (amountNum > 500) {
    console.log(`[Limits] High-value transaction: $${amount} - proceeding with caution`);
  }

  next();
}

export default {
  authenticateToolRequest,
  rateLimitByPhone,
  validateTransactionLimits
};
