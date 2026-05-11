import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'app.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure directory exists
    const dir = dirname(DB_PATH);
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      pubkey TEXT UNIQUE,
      rpc_url TEXT,
      rate REAL NOT NULL,
      power INTEGER NOT NULL,
      fee_rate REAL DEFAULT 0.05,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);

  // Migration: add columns if they don't exist (for existing databases)
  try { db.exec(`ALTER TABLE stations ADD COLUMN rpc_url TEXT`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE payments ADD COLUMN routing_fee INTEGER NOT NULL DEFAULT 0`); } catch { /* exists */ }
  try { db.exec(`ALTER TABLE daily_stats ADD COLUMN total_routing_fee INTEGER NOT NULL DEFAULT 0`); } catch { /* exists */ }

  db.exec(`

    CREATE TABLE IF NOT EXISTS charging_sessions (
      id TEXT PRIMARY KEY,
      station_id INTEGER NOT NULL,
      user_pubkey TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_paid INTEGER DEFAULT 0,
      total_fee INTEGER DEFAULT 0,
      started_at DATETIME,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      payment_hash TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      fee INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      invoice_string TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (session_id) REFERENCES charging_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      payment_hash TEXT NOT NULL,
      amount INTEGER NOT NULL,
      fee INTEGER NOT NULL DEFAULT 0,
      routing_fee INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      preimage TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT NOT NULL,
      station_id INTEGER,
      total_amount INTEGER DEFAULT 0,
      total_fee INTEGER DEFAULT 0,
      total_routing_fee INTEGER DEFAULT 0,
      tx_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (date, station_id),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_session ON invoices(session_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_hash ON invoices(payment_hash);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON charging_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
  `);

  // Seed default stations if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare(`
      INSERT INTO stations (id, name, brand, rpc_url, rate, power, fee_rate, pubkey)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const stations = [
      [1, 'Tesla Supercharger', 'Tesla', process.env.STATION_1_RPC_URL || 'http://127.0.0.1:8237', 0.45, 250, 0.05, process.env.STATION_1_PUBKEY || null],
      [2, 'ChargePoint', 'ChargePoint', process.env.STATION_2_RPC_URL || 'http://127.0.0.1:8247', 0.38, 150, 0.05, process.env.STATION_2_PUBKEY || null],
      [3, 'EVgo Fast Charge', 'EVgo', process.env.STATION_3_RPC_URL || 'http://127.0.0.1:8257', 0.42, 100, 0.05, process.env.STATION_3_PUBKEY || null],
      [4, 'Electrify America', 'EA', process.env.STATION_4_RPC_URL || 'http://127.0.0.1:8267', 0.50, 350, 0.05, process.env.STATION_4_PUBKEY || null],
      [5, 'Blink Charging', 'Blink', process.env.STATION_5_RPC_URL || null, 0.35, 50, 0.05, process.env.STATION_5_PUBKEY || null],
    ];
    for (const s of stations) {
      insert.run(...s);
    }
  } else {
    // Migration: update existing stations with default RPC URLs if null
    const rpcUrls = [
      { id: 1, url: process.env.STATION_1_RPC_URL || 'http://127.0.0.1:8237' },
      { id: 2, url: process.env.STATION_2_RPC_URL || 'http://127.0.0.1:8247' },
      { id: 3, url: process.env.STATION_3_RPC_URL || 'http://127.0.0.1:8257' },
      { id: 4, url: process.env.STATION_4_RPC_URL || 'http://127.0.0.1:8267' },
      { id: 5, url: process.env.STATION_5_RPC_URL || null },
    ];
    const update = db.prepare('UPDATE stations SET rpc_url = ? WHERE id = ? AND rpc_url IS NULL');
    for (const s of rpcUrls) {
      if (s.url) update.run(s.url, s.id);
    }
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
