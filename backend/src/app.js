import express from 'express';
import cors from 'cors';
import customersRouter from './routes/customers.js';
import invoicesRouter from './routes/invoices.js';
import paymentsRouter from './routes/payments.js';
import settingsRouter from './routes/settings.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'baaki-backend',
      timestamp: new Date().toISOString()
    });
  });

  // REST API Modules
  app.use('/api/customers', customersRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/settings', settingsRouter);

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
