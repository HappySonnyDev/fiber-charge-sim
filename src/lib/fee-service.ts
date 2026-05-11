import { CONFIG } from './config';

/**
 * Calculate the amount breakdown for a payment.
 * @param baseAmountCkb - The base amount in CKB (what goes to the station)
 * @param feeRate - Optional override fee rate
 * @returns Breakdown with amount, fee, and total
 */
export function calculatePaymentBreakdown(baseAmountCkb: number, _feeRate?: number) {
  const baseShannon = Math.floor(baseAmountCkb * 100_000_000);

  return {
    baseCkb: baseAmountCkb,
    baseShannon,
    feeShannon: 0,
    feeCkb: 0,
    totalShannon: baseShannon,
    totalCkb: baseAmountCkb,
    feeRate: 0,
  };
}

/**
 * Convert CKB to shannon (1 CKB = 100,000,000 shannon)
 */
export function ckbToShannon(ckb: number): number {
  return Math.floor(ckb * 100_000_000);
}

/**
 * Convert shannon to CKB
 */
export function shannonToCkb(shannon: number): number {
  return shannon / 100_000_000;
}

/**
 * Format amount for display
 */
export function formatCkb(ckb: number): string {
  return `${ckb.toFixed(6)} CKB`;
}
