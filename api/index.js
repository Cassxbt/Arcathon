/**
 * PayVoice API - Vercel Serverless Entry Point
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import webhookRoutes from '../src/routes/webhooks.js';

const app = express();

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

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'PayVoice API',
    version: '1.0.0',
    description: 'Voice-first payment assistant on WhatsApp',
    endpoints: {
      health: '/health',
      balance: 'POST /api/balance',
      send: 'POST /api/send',
      history: 'POST /api/history',
      contacts: 'POST /api/contacts',
      addContact: 'POST /api/contacts/add'
    }
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

// Error handling
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

export default app;
