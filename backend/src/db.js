import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '../baaki.db');
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
