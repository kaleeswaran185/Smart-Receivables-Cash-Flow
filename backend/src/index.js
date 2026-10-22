import dotenv from 'dotenv';
import { createApp } from './app.js';
import { getDatabase } from './db.js';
import { seedDatabase } from './seed.js';

dotenv.config();

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
