// Server-side configuration
export const CONFIG = {
  // Fiber RPC
  FIBER_RPC_URL: process.env.FIBER_RPC_URL || 'http://127.0.0.1:8227',
  FIBER_RPC_BISCUIT_TOKEN: process.env.FIBER_RPC_BISCUIT_TOKEN,

  // L402 / Macaroon
  L402_ROOT_KEY: process.env.L402_ROOT_KEY || generateFallbackKey(),
  L402_EXPIRY_SECONDS: parseInt(process.env.L402_EXPIRY_SECONDS || '3600', 10),

  // Service fee (default 5%)
  SERVICE_FEE_RATE: parseFloat(process.env.SERVICE_FEE_RATE || '0.05'),

  // Invoice amount per interval (in CKB)
  INVOICE_AMOUNT_CKB: parseFloat(process.env.INVOICE_AMOUNT_CKB || '0.01'),

  // Payment interval (ms)
  PAYMENT_INTERVAL_MS: parseInt(process.env.PAYMENT_INTERVAL_MS || '5000', 10),

  // Database
  DATABASE_PATH: process.env.DATABASE_PATH,

  // Router pubkey (for hop_hints)
  ROUTER_PUBKEY: process.env.ROUTER_PUBKEY || '',

  // Router <-> Station channel outpoints (for hop_hints routing)
  STATION_CHANNEL_IDS: {
    1: process.env.STATION_1_CHANNEL_OUTPOINT || '',
    2: process.env.STATION_2_CHANNEL_OUTPOINT || '',
    3: process.env.STATION_3_CHANNEL_OUTPOINT || '',
    4: process.env.STATION_4_CHANNEL_OUTPOINT || '',
    5: process.env.STATION_5_CHANNEL_OUTPOINT || '',
  } as Record<number, string>,

  // Station pubkeys from env
  STATIONS: {
    1: process.env.STATION_1_PUBKEY || process.env.NEXT_PUBLIC_STATION_1_PUBKEY,
    2: process.env.STATION_2_PUBKEY || process.env.NEXT_PUBLIC_STATION_2_PUBKEY,
    3: process.env.STATION_3_PUBKEY || process.env.NEXT_PUBLIC_STATION_3_PUBKEY,
    4: process.env.STATION_4_PUBKEY || process.env.NEXT_PUBLIC_STATION_4_PUBKEY,
    5: process.env.STATION_5_PUBKEY || process.env.NEXT_PUBLIC_STATION_5_PUBKEY,
  } as Record<number, string | undefined>,

  // Station RPC URLs for invoice creation/verification
  STATION_RPC_URLS: {
    1: process.env.STATION_1_RPC_URL || 'http://127.0.0.1:8237',
    2: process.env.STATION_2_RPC_URL || 'http://127.0.0.1:8247',
    3: process.env.STATION_3_RPC_URL || 'http://127.0.0.1:8257',
    4: process.env.STATION_4_RPC_URL || 'http://127.0.0.1:8267',
    5: process.env.STATION_5_RPC_URL || undefined,
  } as Record<number, string | undefined>,
};

function generateFallbackKey(): string {
  // In production, this should come from env. For demo, generate a random key.
  const chars = '0123456789abcdef';
  let key = '';
  for (let i = 0; i < 64; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}
