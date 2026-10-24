import express from 'express';
import cors from 'cors';
import customersRouter from './routes/customers.js';
import invoicesRouter from './routes/invoices.js';
import paymentsRouter from './routes/payments.js';
import settingsRouter from './routes/settings.js';
import followupsRouter, { remindersRouter } from './routes/followups.js';
import publicPayRouter from './routes/publicPay.js';
import dashboardRouter from './routes/dashboard.js';
import forecastRouter from './routes/forecast.js';
import chaseRouter from './routes/chase.js';
import inboxRouter from './routes/inbox.js';
import bankImportRouter from './routes/bankImport.js';
import { getToday } from './lib/dateUtils.js';
import { getDatabase } from './db.js';

import helmet from 'helmet';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

function createRateLimiter({ windowMs = 60 * 1000, max = 120 } = {}) {
  const requests = new Map();
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = requests.get(ip);
    if (!record || now - record.start > windowMs) {
      record = { count: 1, start: now };
      requests.set(ip, record);
    } else {
      record.count += 1;
    }
    if (record.count > max) {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests on public endpoint, please try again shortly.'
      });
    }
    next();
  };
}

export function createApp() {
  const app = express();

  // Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  // CORS allow-list configuration supporting FRONTEND_URL env var
  const rawFrontendUrl = process.env.FRONTEND_URL;
  const allowedOrigins = rawFrontendUrl
    ? rawFrontendUrl.split(',').map((u) => u.trim())
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Allow all Vercel domains (*.vercel.app) for seamless frontend deployments
        if (origin.endsWith('.vercel.app') || /^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true
    })
  );

  // Body-size limit (1mb)
  app.use(express.json({ limit: '1mb' }));

  const publicRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });

  // Health check endpoint (public)
  app.get('/api/health', (req, res) => {
    let todayStr = '2026-10-22';
    try {
      todayStr = getToday(getDatabase());
    } catch (e) {
      // ignore
    }
    res.json({
      status: 'ok',
      service: 'baaki-backend',
      today: todayStr
    });
  });

  // Public Pay Page with rate limiting
  app.use('/api/public/pay', publicRateLimiter, publicPayRouter);

  // Auth routes (login/demo-login/me/logout/config) with rate limiting
  app.use('/api/auth', publicRateLimiter, authRouter);

  // Protected REST API routes (require owner authentication)
  app.use('/api', requireAuth);

  app.use('/api/customers', customersRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/followups', followupsRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/forecast', forecastRouter);
  app.use('/api/chase', chaseRouter);
  app.use('/api/inbox', inboxRouter);
  app.use('/api/bank-import', bankImportRouter);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // Error Handler
  app.use((err, req, res, next) => {
    console.error('Unhandled API Error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  });

  return app;
}

export default createApp;
