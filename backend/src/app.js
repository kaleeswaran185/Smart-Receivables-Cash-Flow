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
import { getToday } from './lib/dateUtils.js';
import { getDatabase } from './db.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
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

  // REST API Modules
  app.use('/api/customers', customersRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/followups', followupsRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/public/pay', publicPayRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/forecast', forecastRouter);
  app.use('/api/chase', chaseRouter);

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
