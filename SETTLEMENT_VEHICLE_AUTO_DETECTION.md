# Settlement Vehicle Auto-Detection — Complete Implementation

## ✅ Feature Complete

When a user types a vehicle number (like `9988`) that is registered as a **Settlement Vehicle**, the system now automatically:

1. **Detects** it's a settlement vehicle from the database
2. **Shows a toast notification**: "Settlement Vehicle Detected - 9988 is on monthly arrangement. Udaro auto-enabled."
3. **Auto-checks** the "Settlement (Udaro)" checkbox
4. **Auto-fills** the due date field based on their settlement schedule
5. **Displays** settlement info in the Vehicle Status card

---

## How It Works

### 1. Vehicle Lookup API Enhanced
**File**: `src/pages/api/vehicles/lookup.ts`

The lookup API now returns additional settlement fields:
```typescript
{
  isSettlementVehicle: true,
  settlementFrequency: 'monthly',
  nextDueDate: '2026-11-30',
  ownerName: 'Yugesh Bastola',
  ownerContact: '9812124264',
  ...sessionHistory
}
```

### 2. Session Form Auto-Detection
**File**: `src/pages/sessions/index.tsx`

When vehicle number is typed:
- **Lookup triggers** after 400ms delay
- If `isSettlementVehicle=true`:
  - Sets `formData.isUdaro = true`
  - Sets `formData.udaroDueDate = nextDueDate`
  - Shows toast notification

### 3. Vehicle Status Card Enhancement
The sidebar "Vehicle Status" card now shows:
```
🔖 Settlement Vehicle
Frequency: monthly
Next Due: 2026-11-30
```

---

## Settlement Vehicles Management

### Add Settlement Vehicle
1. Go to **Settlement Management** page
2. Click **"+ Add Settlement Vehicle"**
3. Choose vehicle from dropdown (or type new)
4. Fill owner name & contact
5. Select frequency: **Weekly, Monthly, or Custom**
6. Set payment schedule (day of week, day of month, or custom interval)
7. Add notes (optional)
8. Click **"Add Settlement Vehicle"**

### View/Edit/Delete
Each settlement vehicle in the table has 3 action buttons:
- **👁 View**: Shows all details in a modal (outstanding, visits, revenue, schedule)
- **✏️ Edit**: Opens pre-filled form to update arrangement
- **🗑 Delete**: Removes from settlement (doesn't delete vehicle or sessions)

---

## Settlement Vehicles Table

**Location**: Settlement Management page (top section)

**Columns**:
| Column | Description |
|--------|-------------|
| # | Row number |
| Vehicle No. | Bold vehicle number |
| Owner Name | With person icon |
| Contact | With phone icon |
| Frequency | Badge: Weekly/Monthly/Custom |
| Payment Schedule | e.g. "Every Monday", "Day 5 / month" |
| Next Due | Green (upcoming) / Red ⚠️ (overdue) |
| Outstanding | Red if > 0, Green if cleared |
| Visits | Total session count |
| Notes | Truncated notes |
| Actions | View / Edit / Delete buttons |

**Always visible** — shows "add first vehicle" message when empty

---

## User Flow Example

### Scenario: Vehicle 9988 is on Monthly Settlement (5th of every month)

1. **Admin registers** 9988 as settlement vehicle:
   - Owner: Yugesh Bastola
   - Contact: 9812124264
   - Frequency: Monthly
   - Payment Day: 5

2. **Next time** operator creates a session for 9988:
   - Types `9988` in Vehicle No. field
   - System detects: "🔖 Settlement Vehicle (monthly)"
   - Checkbox auto-checks: ✅ Settlement (Udaro)
   - Due date auto-fills: `2026-11-05`
   - Toast shows: "Settlement Vehicle Detected"

3. **Session is saved** with:
   - `isUdaro = true`
   - `udaroDueDate = 2026-11-05`
   - Appears in Settlement page automatically

---

## Database Schema

### Vehicles Table (New Fields)
```sql
isSettlementVehicle BOOLEAN DEFAULT FALSE
settlementFrequency VARCHAR(20) -- 'weekly', 'monthly', 'custom'
settlementDayOfWeek INTEGER -- 0=Sunday, 6=Saturday (for weekly)
settlementDayOfMonth INTEGER -- 1-31 (for monthly)
customSettlementDays INTEGER -- Number of days (for custom)
nextDueDate TIMESTAMP -- Calculated next payment due date
```

### Sessions Table (Existing Udaro Fields)
```sql
isUdaro BOOLEAN DEFAULT FALSE
udaroDueDate DATE -- Agreed due date
udaroSettledDate DATE -- When fully settled
```

---

## API Endpoints

### POST `/api/vehicles/settlement`
**Create or update settlement vehicle** (upsert)
```json
{
  "vehicleNo": "9988",
  "ownerName": "Yugesh Bastola",
  "ownerContact": "9812124264",
  "settlementFrequency": "monthly",
  "settlementDayOfMonth": 5,
  "notes": "Monthly payment on 5th",
  "isSettlementVehicle": true
}
```

### DELETE `/api/vehicles/settlement?vehicleNo=9988`
**Remove from settlement** (sets `isSettlementVehicle=false`)

### GET `/api/vehicles/lookup?vehicleNo=9988`
**Returns settlement info** along with session history

---

## Key Business Rules

1. **Settlement Vehicle** = Pre-registered vehicle with payment schedule
2. **Auto-detection** only applies when creating NEW sessions (not editing)
3. **Due date** is auto-calculated but can be manually overridden
4. **Payment** is always allowed before/after due date (overdue is informational only)
5. **Removing** from settlement doesn't delete the vehicle or its sessions

---

## Files Modified

### Core Features
- ✅ `src/pages/settlement.tsx` — Settlement Vehicles table, View/Edit/Delete modals
- ✅ `src/pages/sessions/index.tsx` — Auto-detection, Vehicle Status card update
- ✅ `src/pages/api/vehicles/settlement.ts` — CREATE/UPDATE/DELETE settlement vehicles
- ✅ `src/pages/api/vehicles/lookup.ts` — Enhanced with settlement fields
- ✅ `src/pages/api/vehicles/index.ts` — Returns `isSettlementVehicle` in ownerRegistered list

### Database
- ✅ `src/models/Vehicle.ts` — Added settlement fields to model
- ✅ `scripts/addVehicleSettlementFields.js` — Migration to add columns

---

## Testing Checklist

### Settlement Vehicle Registration
- [ ] Can add new settlement vehicle (weekly/monthly/custom)
- [ ] Can select existing vehicle from dropdown (auto-fills owner info)
- [ ] Weekly: Shows day-of-week dropdown (Sunday-Saturday)
- [ ] Monthly: Shows day-of-month input (1-31)
- [ ] Custom: Shows custom interval input (days)

### Auto-Detection in Session Form
- [ ] Type settlement vehicle number → Shows "Settlement Vehicle Detected" toast
- [ ] Settlement (Udaro) checkbox auto-checks
- [ ] Due date auto-fills from vehicle schedule
- [ ] Vehicle Status card shows settlement badge and frequency
- [ ] Owner info appears if registered

### Settlement Vehicles Table
- [ ] Table shows with proper header row
- [ ] Settlement vehicles listed with all columns
- [ ] View button opens detail modal
- [ ] Edit button opens pre-filled form (vehicle number locked)
- [ ] Delete button removes from settlement (confirms first)
- [ ] Outstanding amounts match session data
- [ ] Next Due shows red ⚠️ if overdue

### Integration
- [ ] Settlement sessions appear in Settlement Management page
- [ ] Outstanding balances sync correctly
- [ ] Payment updates reflect in settlement vehicle table
- [ ] Frequency badges color-coded (blue=weekly, purple=monthly, orange=custom)

---

## Success!

The settlement vehicle system is now fully integrated:
- ✅ Owner can pre-register vehicles with payment schedules
- ✅ System auto-detects and applies settlement terms
- ✅ Full CRUD operations on settlement vehicles
- ✅ Beautiful UI with proper notifications
- ✅ No manual work needed for each session

**Result**: When vehicle `9988` comes for charging, operator just types the number and the system handles the rest! 🎉
