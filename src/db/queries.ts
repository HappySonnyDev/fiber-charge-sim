import { getDb } from './index';

// ─── Stations ───

export interface Station {
  id: number;
  name: string;
  brand: string;
  pubkey: string | null;
  rpc_url: string | null;
  rate: number;
  power: number;
  fee_rate: number;
  created_at: string;
}

export function getStations(): Station[] {
  return getDb().prepare('SELECT * FROM stations ORDER BY id').all() as Station[];
}

export function getStationById(id: number): Station | undefined {
  return getDb().prepare('SELECT * FROM stations WHERE id = ?').get(id) as Station | undefined;
}

export function updateStationFeeRate(id: number, feeRate: number): void {
  getDb().prepare('UPDATE stations SET fee_rate = ? WHERE id = ?').run(feeRate, id);
}

// ─── Charging Sessions ───

export interface ChargingSession {
  id: string;
  station_id: number;
  user_pubkey: string;
  status: 'pending' | 'charging' | 'completed' | 'failed';
  total_paid: number;
  total_fee: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export function createSession(session: Omit<ChargingSession, 'started_at' | 'ended_at' | 'created_at'>): void {
  getDb().prepare(`
    INSERT INTO charging_sessions (id, station_id, user_pubkey, status, total_paid, total_fee)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(session.id, session.station_id, session.user_pubkey, session.status, session.total_paid, session.total_fee);
}

export function getSessionById(id: string): ChargingSession | undefined {
  return getDb().prepare('SELECT * FROM charging_sessions WHERE id = ?').get(id) as ChargingSession | undefined;
}

export function updateSessionStatus(id: string, status: ChargingSession['status']): void {
  const db = getDb();
  if (status === 'charging') {
    db.prepare("UPDATE charging_sessions SET status = ?, started_at = datetime('now') WHERE id = ?")
      .run(status, id);
  } else if (status === 'completed' || status === 'failed') {
    db.prepare("UPDATE charging_sessions SET status = ?, ended_at = datetime('now') WHERE id = ?")
      .run(status, id);
  } else {
    db.prepare('UPDATE charging_sessions SET status = ? WHERE id = ?').run(status, id);
  }
}

export function incrementSessionPayment(id: string, amount: number, fee: number): void {
  getDb().prepare(`
    UPDATE charging_sessions 
    SET total_paid = total_paid + ?, total_fee = total_fee + ? 
    WHERE id = ?
  `).run(amount, fee, id);
}

export function getActiveSessions(): ChargingSession[] {
  return getDb().prepare("SELECT * FROM charging_sessions WHERE status = 'charging' ORDER BY started_at DESC")
    .all() as ChargingSession[];
}

// ─── Invoices ───

export interface Invoice {
  id: string;
  session_id: string;
  payment_hash: string;
  amount: number;
  fee: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  invoice_string: string | null;
  created_at: string;
  paid_at: string | null;
}

export function createInvoice(inv: Omit<Invoice, 'created_at' | 'paid_at'>): void {
  getDb().prepare(`
    INSERT INTO invoices (id, session_id, payment_hash, amount, fee, status, invoice_string)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(inv.id, inv.session_id, inv.payment_hash, inv.amount, inv.fee, inv.status, inv.invoice_string);
}

export function getInvoiceById(id: string): Invoice | undefined {
  return getDb().prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Invoice | undefined;
}

export function getInvoiceByPaymentHash(hash: string): Invoice | undefined {
  return getDb().prepare('SELECT * FROM invoices WHERE payment_hash = ?').get(hash) as Invoice | undefined;
}

export function markInvoicePaid(id: string): void {
  getDb().prepare("UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?")
    .run(id);
}

// ─── Payments ───

export interface Payment {
  id: string;
  invoice_id: string;
  payment_hash: string;
  amount: number;
  fee: number;
  routing_fee: number;
  status: 'pending' | 'confirmed' | 'failed';
  preimage: string | null;
  created_at: string;
}

export function createPayment(payment: Omit<Payment, 'created_at'>): void {
  getDb().prepare(`
    INSERT INTO payments (id, invoice_id, payment_hash, amount, fee, routing_fee, status, preimage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(payment.id, payment.invoice_id, payment.payment_hash, payment.amount, payment.fee, payment.routing_fee, payment.status, payment.preimage);
}

export function getPaymentsBySession(sessionId: string): Payment[] {
  return getDb().prepare(`
    SELECT p.* FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE i.session_id = ?
    ORDER BY p.created_at DESC
  `).all(sessionId) as Payment[];
}

// ─── Daily Stats ───

export interface DailyStat {
  date: string;
  station_id: number | null;
  total_amount: number;
  total_fee: number;
  total_routing_fee: number;
  tx_count: number;
}

export function upsertDailyStat(date: string, stationId: number | null, amount: number, fee: number, routingFee: number = 0): void {
  getDb().prepare(`
    INSERT INTO daily_stats (date, station_id, total_amount, total_fee, total_routing_fee, tx_count)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(date, station_id) DO UPDATE SET
      total_amount = total_amount + excluded.total_amount,
      total_fee = total_fee + excluded.total_fee,
      total_routing_fee = total_routing_fee + excluded.total_routing_fee,
      tx_count = tx_count + 1,
      updated_at = datetime('now')
  `).run(date, stationId, amount, fee, routingFee);
}

export function getDailyStats(startDate?: string, endDate?: string): DailyStat[] {
  let sql = 'SELECT * FROM daily_stats';
  const params: (string | null)[] = [];
  if (startDate && endDate) {
    sql += ' WHERE date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  sql += ' ORDER BY date DESC, station_id';
  return getDb().prepare(sql).all(...params) as DailyStat[];
}

export function getTodayStats(): { total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number } {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total_amount,
           COALESCE(SUM(total_fee), 0) as total_fee,
           COALESCE(SUM(total_routing_fee), 0) as total_routing_fee,
           COALESCE(SUM(tx_count), 0) as tx_count
    FROM daily_stats
    WHERE date = date('now')
  `).get() as { total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number };
  return row;
}

export function getStationStats(stationId: number): { total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number } {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total_amount,
           COALESCE(SUM(total_fee), 0) as total_fee,
           COALESCE(SUM(total_routing_fee), 0) as total_routing_fee,
           COALESCE(SUM(tx_count), 0) as tx_count
    FROM daily_stats
    WHERE station_id = ?
  `).get(stationId) as { total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number };
  return row;
}

// ─── Admin Aggregations ───

export function getStationRevenueRanking() {
  return getDb().prepare(`
    SELECT s.id, s.name, s.brand,
           COALESCE(SUM(d.total_amount), 0) as total_amount,
           COALESCE(SUM(d.total_fee), 0) as total_fee,
           COALESCE(SUM(d.total_routing_fee), 0) as total_routing_fee,
           COALESCE(SUM(d.tx_count), 0) as tx_count
    FROM stations s
    LEFT JOIN daily_stats d ON s.id = d.station_id
    GROUP BY s.id, s.name, s.brand
    ORDER BY total_amount DESC
  `).all() as { id: number; name: string; brand: string; total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number }[];
}

export function getRecentPayments(limit = 50): Payment[] {
  return getDb().prepare(`
    SELECT * FROM payments
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Payment[];
}

export function getAllTimeStats(): { total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number; session_count: number } {
  const paymentStats = getDb().prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_amount,
           COALESCE(SUM(fee), 0) as total_fee,
           COALESCE(SUM(routing_fee), 0) as total_routing_fee,
           COUNT(*) as tx_count
    FROM payments WHERE status = 'confirmed'
  `).get() as { total_amount: number; total_fee: number; total_routing_fee: number; tx_count: number };

  const sessionCount = getDb().prepare(`
    SELECT COUNT(*) as count FROM charging_sessions WHERE status = 'completed'
  `).get() as { count: number };

  return {
    total_amount: paymentStats.total_amount,
    total_fee: paymentStats.total_fee,
    total_routing_fee: paymentStats.total_routing_fee,
    tx_count: paymentStats.tx_count,
    session_count: sessionCount.count,
  };
}
