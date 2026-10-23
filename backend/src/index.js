import dotenv from 'dotenv';
import { createApp } from './app.js';
import { getDatabase } from './db.js';
import { seedDatabase } from './seed.js';

dotenv.config();

// In production, the server must refuse to start without AUTH_SECRET from env
if (process.env.NODE_ENV === 'production' && (!process.env.AUTH_SECRET || !process.env.AUTH_SECRET.trim())) {
  console.error('FATAL CONFIGURATION ERROR: AUTH_SECRET environment variable is strictly required in production mode with no fallback.');
  process.exit(1);
}

// In production, silent demo session and public demo features require DEMO_MODE=true
if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
  console.warn('⚠️ WARNING: DEMO_MODE is not set to "true" in production. Silent demo login and public demo features will be disabled.');
}

const PORT = process.env.PORT || 5000;

// Initialize database and run seed automatically if DB is empty
const db = getDatabase();
const seedResult = seedDatabase(db);
if (seedResult.seeded) {
  console.log('Database initialized and seeded:', seedResult.message);
} else {
  console.log('Database initialized:', seedResult.message);
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`Baaki backend listening on port ${PORT}`);
});
