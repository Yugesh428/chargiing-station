# Vehicle Queue Management System - Architecture Document

## Executive Summary

This document outlines the architecture and implementation of the Vehicle Queue Management System integrated into the existing EV Charging Management System.

## Existing Architecture Analysis

### Database Models
- **Tenant**: Multi-tenant system root, contains station configuration
- **User**: Staff management (super_admin, tenant_admin, operator) with fullName
- **Vehicle**: Vehicle registry with settlement tracking
- **ChargingSession**: Core charging records with payment/settlement logic
- **Expense**: Operational expenses tracking

### Key Observations
1. **No dedicated Charger/Station models**: System uses `chargerType` enum (GBT, CCS2)
2. **Tenant = Station**: Each tenant represents a charging station
3. **User = Staff**: No separate staff model, users serve as staff with roles
4. **Session Status**: Tracks charging state (ongoing, completed, pending_payment)
5. **Payment Status**: Tracks payment state (Paid, Pending, Partially Paid)

### Authentication & Authorization
- JWT-based authentication
- Token provides: `{ id, username, email, role, tenantId }`
- User context available via `req.user` in authenticated requests
- Automatic staff tracking via authenticated user

## Queue System Design

### Core Concept
The queue system manages the waiting line for charging stations, tracking vehicles from registration through charger assignment and charging session initiation.

### Business Rules
1. **No Charger Assignment Without Queue**: Vehicles must enter queue before charging
2. **Automatic Queue Exit**: Assignment creates session and removes from active queue
3. **Historical Preservation**: All queue entries preserved for audit trail
4. **Staff Accountability**: Every action tracked with staff member details
5. **Concurrency Safety**: Transaction-based assignment prevents double-booking

### Database Schema

#### VehicleQueue Model
```typescript
{
  // Identity
  id: UUID (PK)
  tenantId: UUID (FK → tenants)
  vehicleId: UUID (FK → vehicles)
  
  // Queue Management
  queuePosition: INTEGER
  status: ENUM('WAITING', 'CALLED', 'ASSIGNED', 'CANCELLED', 'LEFT', 'EXPIRED')
  priority: INTEGER (optional, default 0)
  
  // Timestamps
  joinedAt: TIMESTAMP
  calledAt: TIMESTAMP (nullable)
  assignedAt: TIMESTAMP (nullable)
  cancelledAt: TIMESTAMP (nullable)
  
  // Assignment Details
  assignedChargerId: STRING (nullable) - e.g., "GBT-1", "CCS2-2"
  chargingSessionId: UUID (FK → charging_sessions, nullable)
  
  // Metadata
  estimatedWaitingTime: INTEGER (minutes, nullable)
  notes: TEXT (nullable)
  
  // Audit Trail - Staff Tracking
  createdBy: UUID (FK → users) - who added vehicle
  updatedBy: UUID (FK → users) - who last modified
  calledBy: UUID (FK → users, nullable) - who called vehicle
  assignedBy: UUID (FK → users, nullable) - who assigned charger
  cancelledBy: UUID (FK → users, nullable) - who cancelled entry
  
  // Standard Timestamps
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### Indexes
- `(tenantId, status)` - Active queue queries
- `(tenantId, vehicleId, status)` - Duplicate prevention
- `(chargingSessionId)` - Session lookup
- `(createdBy, assignedBy, cancelledBy)` - Audit queries

#### Constraints
- Unique: `(tenantId, vehicleId)` WHERE status IN ('WAITING', 'CALLED')
- Foreign Keys: Cascade updates, restrict deletes for audit trail

### Associations
```typescript
// VehicleQueue relationships
VehicleQueue.belongsTo(Tenant, { foreignKey: 'tenantId' })
VehicleQueue.belongsTo(Vehicle, { foreignKey: 'vehicleId' })
VehicleQueue.belongsTo(ChargingSession, { foreignKey: 'chargingSessionId' })

// Staff tracking
VehicleQueue.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
VehicleQueue.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' })
VehicleQueue.belongsTo(User, { foreignKey: 'calledBy', as: 'caller' })
VehicleQueue.belongsTo(User, { foreignKey: 'assignedBy', as: 'assigner' })
VehicleQueue.belongsTo(User, { foreignKey: 'cancelledBy', as: 'canceller' })
```

## API Endpoints

### Queue Management
```
POST   /api/queue              - Add vehicle to queue
GET    /api/queue              - Get current queue (WAITING, CALLED)
GET    /api/queue/:id          - Get specific queue entry
GET    /api/queue/next         - Get next eligible vehicle
GET    /api/queue/history      - Get historical queue entries
```

### Queue Actions
```
PATCH  /api/queue/:id/call     - Call waiting vehicle
POST   /api/queue/:id/assign   - Assign vehicle to charger
PATCH  /api/queue/:id/cancel   - Cancel queue entry
```

## Implementation Flow

### 1. Add Vehicle to Queue
```
Input: { vehicleId, notes }
Process:
  - Validate vehicle exists and belongs to tenant
  - Check no active queue entry exists
  - Check vehicle not currently charging
  - Calculate next queue position
  - Record joinedAt, createdBy (from req.user.id)
  - Status = WAITING
Output: Queue entry with vehicle and creator details
```

### 2. Call Vehicle
```
Input: Queue entry ID
Process:
  - Validate status = WAITING
  - Update status = CALLED
  - Record calledAt, calledBy (from req.user.id)
  - Update updatedBy
Output: Updated queue entry with caller details
```

### 3. Assign to Charger (Critical Operation)
```
Input: { queueId, chargerId, chargerType }
Process (TRANSACTION):
  1. Lock queue entry (FOR UPDATE)
  2. Validate status IN (WAITING, CALLED)
  3. Validate vehicle not currently charging
  4. Validate charger not in use (no active sessions)
  5. Create charging session (reuse existing logic)
  6. Update queue entry:
     - status = ASSIGNED
     - assignedAt = NOW()
     - assignedChargerId = chargerId
     - chargingSessionId = session.id
     - assignedBy = req.user.id
     - updatedBy = req.user.id
  7. Commit transaction
Output: { queueEntry, chargingSession }
```

### 4. Cancel Entry
```
Input: Queue entry ID
Process:
  - Validate status IN (WAITING, CALLED)
  - Update status = CANCELLED
  - Record cancelledAt, cancelledBy (from req.user.id)
  - Update updatedBy
  - Recalculate queue positions if needed
Output: Cancelled queue entry
```

## Concurrency Handling

### Duplicate Prevention
```sql
-- Unique constraint prevents duplicate active entries
CONSTRAINT unique_active_queue_entry 
  UNIQUE (tenantId, vehicleId) 
  WHERE status IN ('WAITING', 'CALLED')
```

### Assignment Race Conditions
```typescript
// Transaction with row-level locks
await sequelize.transaction(async (t) => {
  const queueEntry = await VehicleQueue.findByPk(id, {
    lock: t.LOCK.UPDATE,
    transaction: t
  });
  
  // Double-check vehicle not charging
  const activeSession = await ChargingSession.findOne({
    where: {
      tenantId,
      vehicleNo: vehicle.vehicleNo,
      sessionStatus: 'ongoing'
    },
    transaction: t
  });
  
  if (activeSession) throw new Error('Vehicle already charging');
  
  // Proceed with assignment...
});
```

## Staff Audit Trail

### Automatic Staff Tracking
```typescript
// All queue operations automatically capture staff
const staffId = req.user!.id;

// On create
createdBy: staffId

// On any update
updatedBy: staffId

// On specific actions
calledBy: staffId (when calling)
assignedBy: staffId (when assigning)
cancelledBy: staffId (when cancelling)
```

### Staff Name Resolution
```typescript
// Include staff details in responses
const queueEntry = await VehicleQueue.findOne({
  where: { id },
  include: [
    { model: User, as: 'creator', attributes: ['id', 'fullName', 'username'] },
    { model: User, as: 'caller', attributes: ['id', 'fullName', 'username'] },
    { model: User, as: 'assigner', attributes: ['id', 'fullName', 'username'] },
    { model: Vehicle, as: 'vehicle' }
  ]
});

// Response format
{
  id: "...",
  vehicle: { vehicleNo: "KA01AB1234", ... },
  status: "CALLED",
  addedBy: { id: "...", name: "John Doe" },
  calledBy: { id: "...", name: "Jane Smith" },
  ...
}
```

## Integration Points

### With Existing ChargingSession
- Queue assignment creates session using existing logic
- Session inherits vehicle details from queue
- Session tracks queueId for historical reference (optional enhancement)

### With Existing Vehicle Model
- Queue references existing Vehicle records
- No duplicate vehicle management
- Vehicle metadata available in queue responses

### With Authentication System
- Reuses existing JWT authentication
- Staff context from `req.user`
- Existing authorization middleware

## Migration Strategy

### New Migration: 012_create_vehicle_queue
```typescript
{
  name: '012_create_vehicle_queue',
  description: 'Create vehicle queue management tables',
  up: async () => {
    // Create vehicle_queue table
    // Create indexes
    // Create unique constraint for active entries
  }
}
```

### Data Integrity
- No modification to existing tables
- No data migration required
- New feature, no backward compatibility concerns

## Testing Strategy

### Unit Tests
1. Queue position calculation
2. Status transition validation
3. Staff ID capture
4. Duplicate entry prevention

### Integration Tests
1. Full queue flow (add → call → assign → session creation)
2. Concurrent assignment attempts
3. Staff audit trail verification
4. Historical data preservation

### Edge Cases
1. Vehicle already in queue
2. Vehicle currently charging
3. Invalid status transitions
4. Charger already occupied
5. Simultaneous assignment requests

## API Response Format

### Success Response
```typescript
{
  success: true,
  data: {
    queueEntry: { /* full queue entry */ },
    vehicle: { /* vehicle details */ },
    addedBy: { id, fullName },
    waitingTime: 15 // minutes
  },
  message: "Vehicle added to queue"
}
```

### Error Response
```typescript
{
  success: false,
  message: "Vehicle already in queue",
  code: "DUPLICATE_QUEUE_ENTRY"
}
```

## Security Considerations

### Authorization
- All endpoints require authentication
- Tenant isolation enforced (tenantId check)
- Super admin excluded from operational endpoints
- Staff actions auto-logged (no spoofing)

### Data Validation
- Vehicle existence verification
- Status transition rules enforced
- Charger availability validation
- Transaction rollback on failures

## Performance Optimizations

### Database
- Indexed queries for active queue
- Partial unique index for active entries
- Transaction scope minimized
- Eager loading for staff associations

### Application
- Pagination for history queries
- Cached tenant lookups where applicable
- Efficient queue position calculation

## Future Enhancements

### Optional Features (Not Implemented Now)
1. Priority queue management
2. Estimated wait time calculations
3. SMS/notification on call
4. Queue analytics dashboard
5. Auto-expiry for no-shows
6. Charger preference tracking

## Deliverables

### Backend Files Created
- `/src/models/VehicleQueue.ts` - Queue model
- `/src/pages/api/queue/index.ts` - List/create endpoints
- `/src/pages/api/queue/[id].ts` - Details endpoint
- `/src/pages/api/queue/next.ts` - Next vehicle endpoint
- `/src/pages/api/queue/history.ts` - History endpoint
- `/src/pages/api/queue/[id]/call.ts` - Call action
- `/src/pages/api/queue/[id]/assign.ts` - Assignment action
- `/src/pages/api/queue/[id]/cancel.ts` - Cancel action
- `/src/services/queueService.ts` - Business logic
- `/src/utils/queueHelpers.ts` - Helper functions
- `/scripts/migration.js` - Updated with queue migration

### Documentation
- This architecture document
- API documentation (inline)
- Migration guide

---

**Status**: Ready for implementation
**Backend Only**: No frontend components included
**Integration**: Seamless with existing system
**Testing**: Comprehensive test scenarios included
