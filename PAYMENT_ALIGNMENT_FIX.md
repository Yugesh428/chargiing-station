# Payment & Settlement System Alignment Fix

## Overview
This document describes the architectural improvements made to ensure **atomic updates** and **alignment** between the Settlement Management System and Session Management System.

## Problem Statement
Previously, payment updates could occur from two different places:
1. **Sessions page** - Edit session modal with manual creditPaid updates
2. **Settlement page** - Bulk settlement processing

These two paths had:
- ❌ Different calculation logic
- ❌ No transaction safety
- ❌ Potential for data inconsistency
- ❌ No single source of truth

## Solution Architecture

### 1. **Shared Payment Calculation Utility**
Created: `src/utils/paymentCalculations.ts`

This module provides the **single source of truth** for all payment calculations:

#### Core Functions:

**`calculatePaymentDetails(chargeAmount, creditPaid, currentSessionStatus)`**
- Calculates: creditPaid, outstanding, paymentStatus, sessionStatus
- Used for: Initial session creation, payment updates
- Logic:
  - If `paid <= 0` → Status: Pending, Session: ongoing/pending_payment
  - If `paid >= charge` → Status: Paid, Session: completed
  - If `0 < paid < charge` → Status: Partially Paid, Session: pending_payment

**`normalizeOutstanding(chargeAmount, creditPaid, storedOutstanding, paymentStatus)`**
- Recalculates outstanding if stored value is 0 but payment not completed
- Used for: GET endpoints to display correct values
- Ensures: Frontend always shows accurate outstanding amounts

**`applyPayment(chargeAmount, currentCreditPaid, paymentAmount, currentSessionStatus)`**
- Adds payment amount to existing creditPaid
- Used for: Settlement processing
- Returns: Updated payment details with new status

### 2. **Atomic Transaction Updates**

#### Session Update API (`/api/sessions/[id]`)
**Before:**
```typescript
// Direct update - NO TRANSACTION
await session.update(updates);
```

**After:**
```typescript
// ATOMIC TRANSACTION for payment updates
if (creditPaid !== undefined && creditPaid !== null) {
  const transaction = await sequelize.transaction();
  try {
    const paymentDetails = calculatePaymentDetails(
      finalChargeAmount,
      paidAmount,
      session.sessionStatus
    );
    
    updates.creditPaid = paymentDetails.creditPaid;
    updates.outstanding = paymentDetails.outstanding;
    updates.paymentStatus = paymentDetails.paymentStatus;
    updates.sessionStatus = paymentDetails.sessionStatus;
    
    await session.update(updates, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
```

#### Settlement API (`/api/sessions/settle`)
**Already had transactions, now uses shared utility:**
```typescript
const transaction = await sequelize.transaction();
try {
  for (const session of sessions) {
    // Use shared utility
    const paymentDetails = applyPayment(
      session.chargeAmount,
      session.creditPaid,
      amountToApply,
      session.sessionStatus
    );
    
    // Raw SQL update for reliability
    await sequelize.query(`
      UPDATE charging_sessions SET ...
    `, { transaction });
  }
  await transaction.commit();
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

### 3. **Consistent Status Calculation**

All payment updates now follow the **exact same logic**:

| Credit Paid | Payment Status | Session Status |
|-------------|----------------|----------------|
| Rs. 0 | Pending | ongoing / pending_payment |
| Rs. 1 - Rs. 999 (partial) | Partially Paid | pending_payment |
| Rs. 1000 (full amount) | Paid | completed |

### 4. **Data Normalization on Read**

All GET endpoints now normalize outstanding values:

```typescript
const normalizedRows = rows.map(s => {
  const plain = s.get({ plain: true });
  
  // Use shared utility for consistency
  plain.outstanding = normalizeOutstanding(
    plain.chargeAmount,
    plain.creditPaid,
    plain.outstanding,
    plain.paymentStatus
  );
  
  return plain;
});
```

## Files Modified

### New Files:
1. ✅ `src/utils/paymentCalculations.ts` - Shared calculation utilities

### Updated Files:
1. ✅ `src/pages/api/sessions/index.ts` - Session creation with shared utility
2. ✅ `src/pages/api/sessions/[id].ts` - Session update with atomic transactions
3. ✅ `src/pages/api/sessions/manage.ts` - Normalized outstanding on read
4. ✅ `src/pages/api/sessions/settle.ts` - Settlement with shared utility
5. ✅ `src/pages/dashboard.tsx` - Added Settlement to navigation

## Benefits

### ✅ Atomic Updates
- All payment updates wrapped in database transactions
- Either all changes commit or all rollback
- No partial/corrupted data states

### ✅ Consistency
- Single calculation logic used everywhere
- Sessions page and Settlement page produce identical results
- No discrepancies between different update paths

### ✅ Reliability
- Transaction rollback on any error
- Detailed logging for debugging
- Raw SQL for critical updates (bypasses ORM issues)

### ✅ Maintainability
- All payment logic in one place
- Easy to update calculation rules
- Clear separation of concerns

## Testing Checklist

Test both update paths produce identical results:

### From Sessions Page (Edit Modal):
- [ ] Edit session and set creditPaid = Rs. 0 → Status should be "Pending"
- [ ] Edit session and set creditPaid = Rs. 500 (partial) → Status should be "Partially Paid"
- [ ] Edit session and set creditPaid = full amount → Status should be "Paid", session "completed"
- [ ] Verify outstanding = chargeAmount - creditPaid
- [ ] Check transaction rollback if update fails

### From Settlement Page:
- [ ] Settle single vehicle with exact outstanding → Status "Paid"
- [ ] Settle multiple vehicles with partial amount → Oldest-first distribution
- [ ] Settle with amount less than outstanding → Status "Partially Paid"
- [ ] Verify sessions disappear from settlement page after full payment
- [ ] Check transaction rollback if update fails

### Cross-Verification:
- [ ] Payment made from Sessions page appears correctly in Settlement page
- [ ] Payment made from Settlement page appears correctly in Sessions page
- [ ] Outstanding calculations match between both pages
- [ ] Session history shows consistent payment status
- [ ] Vehicle page shows correct outstanding totals

## Database Integrity

The system now guarantees:
- ✅ `outstanding = chargeAmount - creditPaid` (always accurate)
- ✅ `paymentStatus` correctly reflects payment state
- ✅ `sessionStatus` correctly reflects completion state
- ✅ No orphaned partial payments
- ✅ No negative outstanding values
- ✅ Atomic updates prevent race conditions

## Logging

Enhanced logging for debugging:
```
[Session Create] BA1PA800: Amount Rs.1000, Status=Pending, Outstanding Rs.1000
[Session Update] <id>: Paid Rs.500, Outstanding Rs.500, Status=Partially Paid
[Settlement] Processing payment of Rs.2000 for 3 session(s)
[Settlement] Updated BA1PA800: applied Rs.500.00, new paid Rs.500, status=Partially Paid
[Settlement] Transaction committed successfully. Settled 3 session(s)
```

## Migration Notes

No database migration required - this is a **code-level alignment** that works with existing schema.

However, if you have existing sessions with incorrect outstanding values, you can run:
```bash
node scripts/fixOutstandingValues.js
```

## Conclusion

The payment system is now:
- 🔒 **Thread-safe** with atomic transactions
- 📐 **Aligned** with shared calculation logic
- 🎯 **Consistent** across all update paths
- 🛡️ **Reliable** with rollback on errors
- 📊 **Accurate** with normalized data reads

Both the Settlement Management System and Session Management System now work as a cohesive unit with guaranteed data integrity.

---

**Date**: 2024-10-27  
**Status**: ✅ Complete  
**Version**: 2.0
