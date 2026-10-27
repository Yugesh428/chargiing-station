/**
 * Udaro Due Status Calculation
 * Determines if an Udaro arrangement is due, overdue, or settled
 */

export type UdaroDueStatus = 'not-udaro' | 'not-due' | 'due-today' | 'overdue' | 'settled';

export interface UdaroStatusInfo {
  status: UdaroDueStatus;
  daysOverdue: number;
  label: string;
  color: string; // Tailwind color class
}

/**
 * Calculate the due status for an Udaro session
 * 
 * Business Rules:
 * - Not Udaro: Session is not under credit arrangement
 * - Settled: Outstanding is 0 (paid in full, regardless of when)
 * - Not Due: Due date is in the future
 * - Due Today: Due date is today
 * - Overdue: Due date has passed and outstanding > 0
 * 
 * IMPORTANT: Overdue status does NOT prevent payment - it's informational only
 */
export function calculateUdaroStatus(
  isUdaro: boolean,
  outstanding: number,
  udaroDueDate: string | Date | null,
  paymentStatus: string
): UdaroStatusInfo {
  // Not an Udaro arrangement
  if (!isUdaro) {
    return {
      status: 'not-udaro',
      daysOverdue: 0,
      label: 'Regular Payment',
      color: 'text-slate-500',
    };
  }

  // Fully paid (settled)
  if (paymentStatus === 'Paid' || outstanding <= 0) {
    return {
      status: 'settled',
      daysOverdue: 0,
      label: 'Settled',
      color: 'text-green-600',
    };
  }

  // No due date set (flexible arrangement)
  if (!udaroDueDate) {
    return {
      status: 'not-due',
      daysOverdue: 0,
      label: 'No Due Date',
      color: 'text-blue-500',
    };
  }

  // Calculate days difference
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(udaroDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    // Future due date
    return {
      status: 'not-due',
      daysOverdue: 0,
      label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      color: 'text-blue-600',
    };
  } else if (diffDays === 0) {
    // Due today
    return {
      status: 'due-today',
      daysOverdue: 0,
      label: 'Due Today',
      color: 'text-orange-600',
    };
  } else {
    // Overdue (but payment still allowed!)
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'overdue',
      daysOverdue: overdueDays,
      label: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`,
      color: 'text-red-600',
    };
  }
}

/**
 * Get badge styling for due status
 */
export function getUdaroBadgeClass(status: UdaroDueStatus): string {
  switch (status) {
    case 'settled':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'not-due':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'due-today':
      return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'overdue':
      return 'bg-red-100 text-red-700 border-red-300';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-300';
  }
}

/**
 * Check if payment can be recorded (always true - overdue doesn't block payment)
 */
export function canRecordPayment(
  isUdaro: boolean,
  paymentStatus: string,
  outstanding: number
): { allowed: boolean; reason?: string } {
  // Already fully paid
  if (paymentStatus === 'Paid' || outstanding <= 0) {
    return {
      allowed: false,
      reason: 'Already fully paid',
    };
  }

  // Payment always allowed regardless of due date
  return { allowed: true };
}
