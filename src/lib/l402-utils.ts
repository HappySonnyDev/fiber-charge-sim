import { FiberRpcClient, MacaroonService, type HexString } from '@fiber-pay/sdk/node';
import { CONFIG } from './config';

function toHexLocal(value: number | bigint): HexString {
  return `0x${value.toString(16)}` as HexString;
}

// RPC client cache keyed by URL
const rpcClientCache = new Map<string, FiberRpcClient>();

export function getRpcClient(url?: string): FiberRpcClient {
  const rpcUrl = url || CONFIG.FIBER_RPC_URL;
  if (!rpcClientCache.has(rpcUrl)) {
    rpcClientCache.set(
      rpcUrl,
      new FiberRpcClient({
        url: rpcUrl,
        biscuitToken: CONFIG.FIBER_RPC_BISCUIT_TOKEN,
      })
    );
  }
  return rpcClientCache.get(rpcUrl)!;
}

// Singleton Macaroon service
let macaroonService: MacaroonService | null = null;

export function getMacaroonService(): MacaroonService {
  if (!macaroonService) {
    macaroonService = new MacaroonService(CONFIG.L402_ROOT_KEY);
  }
  return macaroonService;
}

/**
 * Create a new invoice via Fiber RPC.
 * When rpcUrl is provided, creates invoice on the target station node.
 * Otherwise falls back to the default Router node.
 */
export async function createFiberInvoice(params: {
  amountCkb: number;
  description: string;
  expirySeconds?: number;
  rpcUrl?: string;
  allowTrampolineRouting?: boolean;
}) {
  const client = getRpcClient(params.rpcUrl);
  const amountHex = toHexLocal(Math.floor(params.amountCkb * 100_000_000));

  const result = await client.newInvoice({
    amount: amountHex,
    description: params.description,
    currency: 'Fibt',
    ...(params.allowTrampolineRouting ? { allow_trampoline_routing: true } : {}),
  });

  return result;
}

/**
 * Verify a payment by payment hash.
 * For invoice-based payments on the receiving node, checks invoice status.
 * Falls back to getPayment for sender-side verification.
 * When rpcUrl is provided, queries the target station node.
 */
export async function verifyPayment(paymentHash: string, rpcUrl?: string) {
  const client = getRpcClient(rpcUrl);

  // First try: check invoice status (receiving node perspective)
  try {
    const invoiceResult = await client.getInvoice({ payment_hash: paymentHash as `0x${string}` });
    console.log(`[verifyPayment] Invoice status for ${paymentHash.slice(0, 16)}... on ${rpcUrl || 'default'}:`, invoiceResult.status);
    if (invoiceResult.status === 'Paid' || invoiceResult.status === 'Received') {
      return { status: 'Success' as const, fee: '0x0' as `0x${string}` };
    }
    return { status: 'Failed' as const, fee: '0x0' as `0x${string}` };
  } catch (invoiceErr) {
    console.warn(`[verifyPayment] getInvoice failed for ${paymentHash.slice(0, 16)}... on ${rpcUrl || 'default'}:`, invoiceErr);
  }

  // Fallback: check payment status (sending node perspective)
  try {
    const result = await client.getPayment({ payment_hash: paymentHash as `0x${string}` });
    console.log(`[verifyPayment] Payment status for ${paymentHash.slice(0, 16)}... on ${rpcUrl || 'default'}:`, result.status);
    return result;
  } catch (paymentErr) {
    console.warn(`[verifyPayment] getPayment failed for ${paymentHash.slice(0, 16)}... on ${rpcUrl || 'default'}:`, paymentErr);
    return null;
  }
}

/**
 * Mint an L402 macaroon for a payment challenge.
 */
export function mintL402Macaroon(paymentHash: string, resourceId?: string) {
  const service = getMacaroonService();
  return service.mint({
    identifier: `charge-session-${Date.now()}`,
    paymentHash,
    resourceId,
    expirySeconds: CONFIG.L402_EXPIRY_SECONDS,
  });
}

/**
 * Verify an L402 macaroon with a preimage.
 */
export function verifyL402Macaroon(macaroonB64: string, preimage: string) {
  const service = getMacaroonService();
  return service.verify(macaroonB64, preimage);
}

/**
 * Build L402 challenge headers for HTTP 402 response.
 */
export function buildL402ChallengeHeaders(macaroon: string, invoice: string): Record<string, string> {
  return {
    'WWW-Authenticate': `L402 macaroon="${macaroon}", invoice="${invoice}"`,
    'Content-Type': 'application/json',
  };
}
