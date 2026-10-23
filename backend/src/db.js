import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = process.env.DB_PATH || process.env.DATABASE_PATH || path.resolve(__dirname, '../baaki.db');
const SCHEMA_PATH = path.resolve(__dirname, '../schema.sql');

export function createDatabase(dbPath = DEFAULT_DB_PATH) {
  const db = new Database(dbPath);

  // Enable foreign keys and WAL mode for performance & safety
  db.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Initialize schema
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);

    // Backward compatibility for existing DBs
    try {
      db.exec('ALTER TABLE business ADD COLUMN turnover_paise INTEGER DEFAULT 6500000000');
    } catch (e) {}

    try {
      db.exec("ALTER TABLE customers ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en'");
    } catch (e) {}

    try {
      db.exec("ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'");
    } catch (e) {}

    try {
      db.exec('ALTER TABLE payments ADD COLUMN is_overpayment INTEGER DEFAULT 0');
    } catch (e) {}

    try {
      db.exec('ALTER TABLE payments ADD COLUMN overpayment_paise INTEGER DEFAULT 0');
    } catch (e) {}

    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_invoice_stage ON reminders(invoice_id, stage)');
    } catch (e) {}

    // Ensure reminders table allows 'SKIPPED' status in CHECK constraint
    try {
      const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reminders'").get();
      if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('SKIPPED')) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE reminders_migration_skipped (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
            invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            reminder_type TEXT NOT NULL CHECK(reminder_type IN ('UPCOMING', 'DUE_TODAY', 'OVERDUE_GENTLE', 'OVERDUE_FIRM', 'URGENT_HOLD', 'LEGAL_NOTICE', 'CUSTOM')),
            stage INTEGER DEFAULT 0,
            channel TEXT NOT NULL CHECK(channel IN ('WHATSAPP', 'SMS', 'EMAIL')),
            scheduled_at TEXT NOT NULL,
            sent_at TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED')),
            message_body TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(invoice_id, stage)
          );
          INSERT INTO reminders_migration_skipped (id, business_id, invoice_id, customer_id, reminder_type, stage, channel, scheduled_at, sent_at, status, message_body, created_at)
          SELECT id, business_id, invoice_id, customer_id, reminder_type, stage, channel, scheduled_at, sent_at, status, message_body, created_at FROM reminders;
          DROP TABLE reminders;
          ALTER TABLE reminders_migration_skipped RENAME TO reminders;
          CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON reminders(invoice_id);
          CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_invoice_stage ON reminders(invoice_id, stage);
          PRAGMA foreign_keys = ON;
        `);
      }
    } catch (e) {
      console.error('Failed to migrate reminders table constraint:', e);
    }
  } else {
    throw new Error(`Schema file not found at ${SCHEMA_PATH}`);
  }

  return db;
}

// Singleton database instance for the application runtime
let dbInstance = null;

export function setDatabase(db) {
  dbInstance = db;
}

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // ignore
    }
    dbInstance = null;
  }
}

export default getDatabase;
