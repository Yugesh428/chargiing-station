# Settlement Management System - Guide

## Overview
The settlement management system allows tracking and settling payments for credit customers who pay weekly, monthly, or on custom schedules.

## Features Implemented

### 1. Individual Session Settlement
- **"Settle" button** appears on each session row where there's outstanding payment
- Clicking opens a settlement modal with:
  - Settlement Date (pre-filled with today)
  - Settlement Method (Cash or Bank/QR)
  - Amount Paid (pre-filled with outstanding amount)
- Processes payment for that specific session

### 2. Bulk Settlement ("Settle Pending" Button)
- Located in the header next to "Import" and "New Session"
- Settles ALL pending sessions at once
- Opens settlement modal showing:
  - Number of sessions being settled
  - Total outstanding amount pre-filled
  - Settlement date and method selection
- Distributes payment across all pending sessions (oldest first)

### 3. Payment Distribution Logic
- **Oldest sessions get paid first** (fair distribution)
- If payment covers full outstanding → Session marked as "Paid" and "completed"
- If payment is partial → Session marked as "Partially Paid" and "pending_payment"
- Remaining amount distributed to next sessions in order

### 4. Database Fields
Each charging session tracks:
- `creditPaid` - Total amount paid so far
- `outstanding` - Remaining amount to be paid
- `settlementMethod` - How payment was received (Cash/Bank/QR)
- `settlementDate` - When payment was received
- `paymentStatus` - Paid/Pending/Partially Paid
- `sessionStatus` - ongoing/pending_payment/completed

## Usage Workflow

### Scenario 1: Quick Cash Payment
1. Customer pays Rs. 500 for one session
2. Click "Settle" button on that session
3. Confirm amount and method
4. Submit → Session marked as Paid

### Scenario 2: Weekly Credit Settlement
1. Customer has 5 sessions over the week, total Rs. 2,500 outstanding
2. Customer pays Rs. 2,500 at week end
3. Click "Settle Pending" button
4. Enter Rs. 2,500 with Bank/QR method
5. Submit → All 5 sessions marked as Paid in chronological order

### Scenario 3: Partial Payment
1. Customer has Rs. 3,000 outstanding across 3 sessions
2. Customer pays Rs. 1,500 (partial)
3. Click "Settle Pending" button
4. Enter Rs. 1,500
5. Submit → Oldest sessions get paid first, remaining stays outstanding

## API Endpoint

**POST /api/sessions/settle**

Request body:
```json
{
  "sessionIds": ["uuid1", "uuid2", "uuid3"],
  "settlementMethod": "Cash",
  "settlementDate": "2024-10-26",
  "amountPaid": "1500.00"
}
```

Response:
```json
{
  "message": "Settlement processed successfully",
  "settledSessions": [
    {
      "id": "uuid1",
      "vehicleNo": "BA 1 PA 800",
      "amountApplied": 500.00,
      "paymentStatus": "Paid"
    }
  ],
  "totalAmount": 1500.00,
  "totalOutstanding": 2500.00,
  "remainingAmount": 0.00,
  "sessionsSettled": 3
}
```

## Migration Required

Run this command to add the `rateMaster` column:
```bash
npm run migrate:rate-master
```

This adds the rateMaster JSONB column to the tenants table with default rates (Rs 6-13 per %).

## Files Modified/Created

1. **src/pages/sessions/index.tsx** - Added settlement UI and buttons
2. **src/pages/api/sessions/settle.ts** - New API endpoint for processing settlements
3. **src/models/ChargingSession.ts** - Already had settlement fields
4. **scripts/addRateMaster.js** - Migration script for rateMaster column
5. **package.json** - Added migrate:rate-master script

## Notes

- Settlement only affects sessions with `outstanding > 0` or `paymentStatus = 'Pending'`
- Fully paid sessions don't show the "Settle" button
- "Settle Pending" button shows count of pending sessions
- Toast notifications confirm successful settlements
- All monetary calculations use 2 decimal precision
- Settlement date can be backdated if needed
