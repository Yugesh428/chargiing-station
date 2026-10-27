/**
 * Shared payment calculation utilities
 * Ensures consistent payment status and outstanding calculations across the system
 */

export interface PaymentCalculation {
  creditPaid: number;
  outstanding: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partially Paid';
  sessionStatus: 'ongoing' | 'pending_payment' | 'completed';
}

/**
 * Calculate payment details based on charge amount and paid amount
 * This is the single source of truth for payment calculations
 * 
 * IMPORTANT: sessionStatus should be based on Departure SOC, NOT payment
 * - Pass 'ongoing' if departureSoc is NULL/empty
 * - Pass 'completed' if departureSoc is filled
 * This function will preserve that status and only update payment-related fields
 */
export function calculatePaymentDetails(
  chargeAmount: number,
  creditPaid: number,
  currentSessionStatus?: string
): PaymentCalculation {
  const charge = parseFloat(String(chargeAmount)) || 0;
  const paid = parseFloat(String(creditPaid)) || 0;
  const outstanding = parseFloat(Math.max(0, charge - paid).toFixed(2));

  let paymentStatus: 'Paid' | 'Pending' | 'Partially Paid';
  
  // Payment status is purely based on money paid vs charge amount
  if (paid <= 0) {
    paymentStatus = 'Pending';
  } else if (paid >= charge) {
    paymentStatus = 'Paid';
  } else {
    paymentStatus = 'Partially Paid';
  }

  // Session status is passed in and preserved (should be based on departureSoc)
  // Default to 'pending_payment' if not provided for backward compatibility
  const sessionStatus = (currentSessionStatus as any) || 'pending_payment';

  return {
    creditPaid: parseFloat(paid.toFixed(2)),
    outstanding,
    paymentStatus,
    sessionStatus,
  };
}

/**
 * Normalize outstanding for display
 * Recalculates outstanding if stored value is 0 but session is not Paid
 */
export function normalizeOutstanding(
  chargeAmount: number,
  creditPaid: number,
  storedOutstanding: number,
  paymentStatus: string
): number {
  const stored = parseFloat(String(storedOutstanding));
  
  // If payment is completed, outstanding should be 0
  if (paymentStatus === 'Paid') return 0;
  
  // If stored value is valid (> 0), use it
  if (!isNaN(stored) && stored > 0) return stored;
  
  // Otherwise recalculate
  const charge = parseFloat(String(chargeAmount)) || 0;
  const paid = parseFloat(String(creditPaid)) || 0;
  return parseFloat(Math.max(0, charge - paid).toFixed(2));
}

/**
 * Apply a payment amount to a session
 * Returns updated payment details
 */
export function applyPayment(
  chargeAmount: number,
  currentCreditPaid: number,
  paymentAmount: number,
  currentSessionStatus?: string
): PaymentCalculation {
  const currentPaid = parseFloat(String(currentCreditPaid)) || 0;
  const newPaid = currentPaid + (parseFloat(String(paymentAmount)) || 0);
  
  return calculatePaymentDetails(chargeAmount, newPaid, currentSessionStatus);
}
