/**
 * PayVoice - Express Server
 * Main entry point for the WhatsApp voice payment agent
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import webhookRoutes from './routes/webhooks.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    // Log body without sensitive data
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.walletAddress) {
      sanitizedBody.walletAddress = sanitizedBody.walletAddress.substring(0, 10) + '...';
    }
    console.log(`  Body: ${JSON.stringify(sanitizedBody)}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'PayVoice API'
  });
});

// Mount webhook routes
app.use('/api', webhookRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}`);
  console.error(`  Message: ${err.message}`);
  console.error(`  Stack: ${err.stack}`);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : message,
    message: statusCode === 500 ? 'An unexpected error occurred' : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         PayVoice API Server               ║
  ╠═══════════════════════════════════════════╣
  ║  Status:  Running                         ║
  ║  Port:    ${PORT}                            ║
  ║  Health:  http://localhost:${PORT}/health    ║
  ╚═══════════════════════════════════════════╝
  `);
  console.log(`[${new Date().toISOString()}] Server started on port ${PORT}`);
});

export default app;
