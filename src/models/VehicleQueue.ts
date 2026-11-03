import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type QueueStatus = 'WAITING' | 'CALLED' | 'ASSIGNED' | 'CANCELLED' | 'LEFT' | 'EXPIRED';

interface VehicleQueueAttributes {
  id: string;
  tenantId: string;
  vehicleId: string;
  
  // Queue Management
  queuePosition: number;
  status: QueueStatus;
  priority: number;
  
  // Timestamps
  joinedAt: Date;
  calledAt?: Date;
  assignedAt?: Date;
  cancelledAt?: Date;
  
  // Assignment Details
  assignedChargerId?: string; // e.g., "GBT-1", "CCS2-2"
  chargingSessionId?: string;
  
  // Metadata
  estimatedWaitingTime?: number; // in minutes
  notes?: string;
  
  // Audit Trail - Staff Tracking
  createdBy: string; // User ID who added vehicle
  updatedBy: string; // User ID who last modified
  calledBy?: string; // User ID who called vehicle
  assignedBy?: string; // User ID who assigned charger
  cancelledBy?: string; // User ID who cancelled entry
  
  // Standard Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

interface VehicleQueueCreationAttributes
  extends Optional<
    VehicleQueueAttributes,
    | 'id'
    | 'queuePosition'
    | 'priority'
    | 'calledAt'
    | 'assignedAt'
    | 'cancelledAt'
    | 'assignedChargerId'
    | 'chargingSessionId'
    | 'estimatedWaitingTime'
    | 'notes'
    | 'calledBy'
    | 'assignedBy'
    | 'cancelledBy'
    | 'updatedBy'
    | 'createdAt'
    | 'updatedAt'
  > {}

class VehicleQueue
  extends Model<VehicleQueueAttributes, VehicleQueueCreationAttributes>
  implements VehicleQueueAttributes
{
  public id!: string;
  public tenantId!: string;
  public vehicleId!: string;
  
  public queuePosition!: number;
  public status!: QueueStatus;
  public priority!: number;
  
  public joinedAt!: Date;
  public calledAt?: Date;
  public assignedAt?: Date;
  public cancelledAt?: Date;
  
  public assignedChargerId?: string;
  public chargingSessionId?: string;
  
  public estimatedWaitingTime?: number;
  public notes?: string;
  
  public createdBy!: string;
  public updatedBy!: string;
  public calledBy?: string;
  public assignedBy?: string;
  public cancelledBy?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

VehicleQueue.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'vehicles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT', // Prevent vehicle deletion if in queue
    },
    queuePosition: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Position in the waiting queue',
    },
    status: {
      type: DataTypes.ENUM('WAITING', 'CALLED', 'ASSIGNED', 'CANCELLED', 'LEFT', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'WAITING',
      comment: 'Current queue status',
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Higher number = higher priority (0 = normal)',
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the vehicle entered the queue',
    },
    calledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the vehicle was called by staff',
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the vehicle was assigned to a charger',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the queue entry was cancelled',
    },
    assignedChargerId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Identifier of the assigned charger (e.g., GBT-1, CCS2-2)',
    },
    chargingSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'charging_sessions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Associated charging session after assignment',
    },
    estimatedWaitingTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Estimated waiting time in minutes',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional staff remarks or notes',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Staff member who added the vehicle to queue',
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Staff member who last modified the queue entry',
    },
    calledBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Staff member who called the vehicle',
    },
    assignedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Staff member who assigned the charger',
    },
    cancelledBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Staff member who cancelled the queue entry',
    },
  },
  {
    sequelize,
    tableName: 'vehicle_queue',
    timestamps: true,
    indexes: [
      // Active queue queries
      {
        name: 'idx_vehicle_queue_tenant_status',
        fields: ['tenantId', 'status'],
      },
      // Prevent duplicate active entries
      {
        name: 'idx_vehicle_queue_tenant_vehicle',
        fields: ['tenantId', 'vehicleId'],
      },
      // Session lookup
      {
        name: 'idx_vehicle_queue_session',
        fields: ['chargingSessionId'],
      },
      // Audit queries
      {
        name: 'idx_vehicle_queue_created_by',
        fields: ['createdBy'],
      },
      {
        name: 'idx_vehicle_queue_assigned_by',
        fields: ['assignedBy'],
      },
      // Queue position ordering
      {
        name: 'idx_vehicle_queue_position',
        fields: ['tenantId', 'status', 'priority', 'queuePosition', 'joinedAt'],
      },
    ],
  }
);

export default VehicleQueue;
