/**
 * Vehicle Queue Service
 * 
 * Business logic for queue management operations
 * Handles validation, status transitions, and concurrency control
 */

import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import { VehicleQueue, Vehicle, ChargingSession, User } from '../models';
import { QueueStatus } from '../models/VehicleQueue';

export interface QueueCreationData {
  tenantId: string;
  vehicleId: string;
  notes?: string;
  priority?: number;
  staffId: string; // Authenticated user ID
}

export interface QueueAssignmentData {
  queueId: string;
  chargerId: string; // e.g., "GBT-1", "CCS2-2"
  chargerType: 'GBT' | 'CCS2';
  tenantId: string;
  staffId: string;
  
  // Optional session data
  arrivalSoc?: number;
  ratePerPercent?: number;
  paymentMethod?: string;
  paymentStatus?: string;
}

/**
 * Validate status transition
 */
export function isValidStatusTransition(from: QueueStatus, to: QueueStatus): boolean {
  const validTransitions: Record<QueueStatus, QueueStatus[]> = {
    WAITING: ['CALLED', 'ASSIGNED', 'CANCELLED', 'LEFT', 'EXPIRED'],
    CALLED: ['ASSIGNED', 'CANCELLED', 'LEFT', 'WAITING'], // Can revert to waiting
    ASSIGNED: [], // Terminal state (preserved for history)
    CANCELLED: [], // Terminal state
    LEFT: [], // Terminal state
    EXPIRED: [], // Terminal state
  };

  return validTransitions[from]?.includes(to) || false;
}

/**
 * Calculate next queue position for a tenant
 */
export async function getNextQueuePosition(tenantId: string): Promise<number> {
  const maxPosition = await VehicleQueue.max('queuePosition', {
    where: {
      tenantId,
      status: ['WAITING', 'CALLED'],
    },
  }) as number | null;

  return (maxPosition || 0) + 1;
}

/**
 * Check if vehicle has an active queue entry
 */
export async function hasActiveQueueEntry(
  tenantId: string,
  vehicleId: string
): Promise<boolean> {
  const activeEntry = await VehicleQueue.findOne({
    where: {
      tenantId,
      vehicleId,
      status: ['WAITING', 'CALLED'],
    },
  });

  return !!activeEntry;
}

/**
 * Check if vehicle is currently charging
 */
export async function isVehicleCharging(
  tenantId: string,
  vehicleNo: string
): Promise<boolean> {
  const activeSession = await ChargingSession.findOne({
    where: {
      tenantId,
      vehicleNo,
      sessionStatus: 'ongoing',
    },
  });

  return !!activeSession;
}

/**
 * Check if charger is currently in use
 */
export async function isChargerOccupied(
  tenantId: string,
  chargerId: string
): Promise<boolean> {
  // Since we don't have a dedicated Charger model, we check for active sessions
  // using this charger ID (stored in queue or inferred from chargerType)
  
  // Check if any active queue entry has this charger assigned
  const occupiedQueue = await VehicleQueue.findOne({
    where: {
      tenantId,
      assignedChargerId: chargerId,
      status: 'ASSIGNED',
    },
    include: [
      {
        model: ChargingSession,
        as: 'chargingSession',
        where: {
          sessionStatus: 'ongoing',
        },
        required: true,
      },
    ],
  });

  return !!occupiedQueue;
}

/**
 * Add vehicle to queue
 */
export async function addToQueue(data: QueueCreationData) {
  const { tenantId, vehicleId, notes, priority = 0, staffId } = data;

  // Validate vehicle exists
  const vehicle = await Vehicle.findOne({
    where: { id: vehicleId, tenantId },
  });

  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  // Check for active queue entry
  const hasActive = await hasActiveQueueEntry(tenantId, vehicleId);
  if (hasActive) {
    throw new Error('Vehicle already in queue');
  }

  // Check if vehicle is currently charging
  const isCharging = await isVehicleCharging(tenantId, vehicle.vehicleNo);
  if (isCharging) {
    throw new Error('Vehicle is currently charging');
  }

  // Calculate queue position
  const queuePosition = await getNextQueuePosition(tenantId);

  // Create queue entry
  const queueEntry = await VehicleQueue.create({
    tenantId,
    vehicleId,
    queuePosition,
    status: 'WAITING',
    priority,
    joinedAt: new Date(),
    notes: notes || null,
    createdBy: staffId,
    updatedBy: staffId,
  });

  // Fetch full entry with associations
  return await VehicleQueue.findByPk(queueEntry.id, {
    include: [
      {
        model: Vehicle,
        as: 'vehicle',
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'username', 'email'],
      },
    ],
  });
}

/**
 * Call a vehicle from the queue
 */
export async function callVehicle(
  queueId: string,
  tenantId: string,
  staffId: string
) {
  const queueEntry = await VehicleQueue.findOne({
    where: { id: queueId, tenantId },
  });

  if (!queueEntry) {
    throw new Error('Queue entry not found');
  }

  if (queueEntry.status !== 'WAITING') {
    throw new Error(`Cannot call vehicle with status: ${queueEntry.status}`);
  }

  // Update to CALLED
  await queueEntry.update({
    status: 'CALLED',
    calledAt: new Date(),
    calledBy: staffId,
    updatedBy: staffId,
  });

  // Return with associations
  return await VehicleQueue.findByPk(queueId, {
    include: [
      {
        model: Vehicle,
        as: 'vehicle',
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'username'],
      },
      {
        model: User,
        as: 'caller',
        attributes: ['id', 'fullName', 'username'],
      },
    ],
  });
}

/**
 * Assign vehicle to charger (CRITICAL OPERATION)
 * 
 * This is a complex transaction that:
 * 1. Validates queue entry and charger availability
 * 2. Creates a charging session
 * 3. Updates queue entry to ASSIGNED
 * 4. Ensures concurrency safety
 */
export async function assignToCharger(data: QueueAssignmentData) {
  const {
    queueId,
    chargerId,
    chargerType,
    tenantId,
    staffId,
    arrivalSoc,
    ratePerPercent,
    paymentMethod = 'Cash',
    paymentStatus = 'Pending',
  } = data;

  return await sequelize.transaction(async (transaction: Transaction) => {
    // 1. Lock and fetch queue entry
    const queueEntry = await VehicleQueue.findOne({
      where: { id: queueId, tenantId },
      lock: transaction.LOCK.UPDATE,
      transaction,
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
        },
      ],
    });

    if (!queueEntry) {
      throw new Error('Queue entry not found');
    }

    if (!['WAITING', 'CALLED'].includes(queueEntry.status)) {
      throw new Error(`Cannot assign vehicle with status: ${queueEntry.status}`);
    }

    const vehicle = queueEntry.vehicle as any;
    if (!vehicle) {
      throw new Error('Vehicle data not found');
    }

    // 2. Double-check vehicle not currently charging
    const activeSession = await ChargingSession.findOne({
      where: {
        tenantId,
        vehicleNo: vehicle.vehicleNo,
        sessionStatus: 'ongoing',
      },
      transaction,
    });

    if (activeSession) {
      throw new Error('Vehicle is already charging');
    }

    // 3. Check charger availability
    const chargerOccupied = await VehicleQueue.findOne({
      where: {
        tenantId,
        assignedChargerId: chargerId,
        status: 'ASSIGNED',
      },
      include: [
        {
          model: ChargingSession,
          as: 'chargingSession',
          where: {
            sessionStatus: 'ongoing',
          },
          required: true,
        },
      ],
      transaction,
    });

    if (chargerOccupied) {
      throw new Error(`Charger ${chargerId} is currently occupied`);
    }

    // 4. Get staff details for operator field
    const staff = await User.findByPk(staffId, { transaction });
    const operatorName = staff?.fullName || staff?.username || 'Unknown';

    // 5. Calculate visit number
    const visitCount = await ChargingSession.count({
      where: { tenantId, vehicleNo: vehicle.vehicleNo },
      transaction,
    });
    const visitNo = visitCount + 1;

    // 6. Get tenant settings for calculations
    const { Tenant } = await import('../models');
    const tenant = await Tenant.findByPk(tenantId, { transaction });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const electricityRate = parseFloat(String(tenant.electricityRate)) || 17;
    const neaCostRate = parseFloat(String(tenant.neaCostRate)) || 9.35;

    // 7. Initialize session with minimal data (ongoing charging)
    // Charge calculations will happen when departure SOC is recorded
    let chargedPercent = null;
    let chargeAmount = 0;
    let usedKwh = 0;
    let electricityCost = 0;
    let netContribution = 0;

    // If we have SOC data at assignment time (unusual but possible)
    if (arrivalSoc != null && ratePerPercent != null) {
      // Just record arrival SOC, no charge calculation yet
      // Departure SOC will be recorded later
    }

    // 8. Create charging session
    const chargingSession = await ChargingSession.create(
      {
        tenantId,
        date: new Date(),
        time: new Date().toTimeString().slice(0, 5),
        vehicleNo: vehicle.vehicleNo,
        arrivalSoc: arrivalSoc != null ? Number(arrivalSoc) : null,
        departureSoc: null, // Will be filled when charging completes
        chargedPercent,
        ratePerPercent: ratePerPercent != null ? Number(ratePerPercent) : null,
        chargeAmount,
        visitNo,
        chargerType,
        paymentMethod,
        paymentStatus,
        sessionStatus: 'ongoing', // Always starts as ongoing
        operator: operatorName,
        remarks: `Assigned from queue to charger ${chargerId}`,
        usedKwh,
        electricityRate,
        electricityCost,
        netContribution,
        creditPaid: 0,
        outstanding: 0,
        companyBrand: vehicle.companyBrand || null,
        isUdaro: false,
      },
      { transaction }
    );

    // 9. Update queue entry to ASSIGNED
    await queueEntry.update(
      {
        status: 'ASSIGNED',
        assignedAt: new Date(),
        assignedChargerId: chargerId,
        chargingSessionId: chargingSession.id,
        assignedBy: staffId,
        updatedBy: staffId,
      },
      { transaction }
    );

    // 10. Return complete data
    const updatedQueueEntry = await VehicleQueue.findByPk(queueId, {
      include: [
        {
          model: Vehicle,
          as: 'vehicle',
        },
        {
          model: ChargingSession,
          as: 'chargingSession',
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'fullName', 'username'],
        },
        {
          model: User,
          as: 'assigner',
          attributes: ['id', 'fullName', 'username'],
        },
      ],
      transaction,
    });

    return {
      queueEntry: updatedQueueEntry,
      chargingSession,
    };
  });
}

/**
 * Cancel queue entry
 */
export async function cancelQueueEntry(
  queueId: string,
  tenantId: string,
  staffId: string
) {
  const queueEntry = await VehicleQueue.findOne({
    where: { id: queueId, tenantId },
  });

  if (!queueEntry) {
    throw new Error('Queue entry not found');
  }

  if (!['WAITING', 'CALLED'].includes(queueEntry.status)) {
    throw new Error(`Cannot cancel entry with status: ${queueEntry.status}`);
  }

  // Update to CANCELLED
  await queueEntry.update({
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelledBy: staffId,
    updatedBy: staffId,
  });

  // Return with associations
  return await VehicleQueue.findByPk(queueId, {
    include: [
      {
        model: Vehicle,
        as: 'vehicle',
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'username'],
      },
      {
        model: User,
        as: 'canceller',
        attributes: ['id', 'fullName', 'username'],
      },
    ],
  });
}

/**
 * Get active queue (WAITING and CALLED entries)
 */
export async function getActiveQueue(tenantId: string, page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const { count, rows } = await VehicleQueue.findAndCountAll({
    where: {
      tenantId,
      status: ['WAITING', 'CALLED'],
    },
    include: [
      {
        model: Vehicle,
        as: 'vehicle',
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'username'],
      },
      {
        model: User,
        as: 'caller',
        attributes: ['id', 'fullName', 'username'],
        required: false,
      },
    ],
    order: [
      ['priority', 'DESC'], // Higher priority first
      ['queuePosition', 'ASC'], // Then by position
      ['joinedAt', 'ASC'], // Finally by time
    ],
    limit,
    offset,
  });

  // Calculate waiting time for each entry
  const now = new Date();
  const enrichedRows = rows.map((row) => {
    const plain = row.get({ plain: true });
    const joinedAt = new Date(plain.joinedAt);
    const waitingMinutes = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60));

    return {
      ...plain,
      waitingMinutes,
    };
  });

  return {
    queue: enrichedRows,
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
  };
}

/**
 * Get next eligible vehicle
 */
export async function getNextVehicle(tenantId: string) {
  const nextEntry = await VehicleQueue.findOne({
    where: {
      tenantId,
      status: 'WAITING',
    },
    include: [
      {
        model: Vehicle,
        as: 'vehicle',
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'username'],
      },
    ],
    order: [
      ['priority', 'DESC'],
      ['queuePosition', 'ASC'],
      ['joinedAt', 'ASC'],
    ],
  });

  if (!nextEntry) {
    return null;
  }

  const plain = nextEntry.get({ plain: true });
  const now = new Date();
  const joinedAt = new Date(plain.joinedAt);
  const waitingMinutes = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60));

  return {
    ...plain,
    waitingMinutes,
  };
}

/**
 * Get queue history (all entries including completed)
 */
export async function getQueueHistory(
  tenantId: string,
  filters: {
    status?: QueueStatus[];
    vehicleId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }
) {
  const { status, vehicleId, startDate, endDate, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const where: any = { tenantId };

  if (status && status.length > 0) {
    where.status = status;
  }

  if (vehicleId) {
    where.vehicleId = vehicleId;
  }

  if (startDate || endDate) {
    where.joinedAt = {};
    if (startDate) where.joinedAt[sequelize.Op.gte] = new Date(startDate);
    if (endDate) where.joinedAt[sequelize.Op.lte] = new Date(endDate);
  }

  const { count, rows } = await VehicleQueue.findAndCountAll({
    where,
    include: [
      {
        model: Vehicle,
        as: 'vehicle',
      },
      {
        model: ChargingSession,
        as: 'chargingSession',
        required: false,
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'username'],
        required: false,
      },
      {
        model: User,
        as: 'caller',
        attributes: ['id', 'fullName', 'username'],
        required: false,
      },
      {
        model: User,
        as: 'assigner',
        attributes: ['id', 'fullName', 'username'],
        required: false,
      },
      {
        model: User,
        as: 'canceller',
        attributes: ['id', 'fullName', 'username'],
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return {
    history: rows.map((r) => r.get({ plain: true })),
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
  };
}
