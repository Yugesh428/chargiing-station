import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ChargingSessionAttributes {
  id: string;
  tenantId: string;
  date: Date;
  time?: string;
  vehicleNo: string;
  arrivalSoc?: number; // Optional
  departureSoc?: number; // Optional
  chargedPercent?: number; // Optional
  ratePerPercent?: number; // Optional
  chargeAmount: number;
  visitNo: number;
  chargerType: string;
  paymentMethod: string;
  paymentStatus: string;
  sessionStatus: string; // 'ongoing', 'completed', 'pending_payment'
  operator?: string;
  remarks?: string;
  usedKwh: number;
  electricityRate: number;
  electricityCost: number;
  netContribution: number;
  creditPaid?: number;
  outstanding?: number;
  settlementMethod?: string;
  settlementDate?: Date;
  companyBrand?: string;
  isUdaro?: boolean; // NEW: Marks if this is under Settlement (Udaro) arrangement
  udaroDueDate?: Date; // NEW: When the Udaro payment is due
  udaroSettledDate?: Date; // NEW: When the Udaro was fully paid
  createdAt?: Date;
  updatedAt?: Date;
}

interface ChargingSessionCreationAttributes extends Optional<ChargingSessionAttributes, 'id' | 'time' | 'operator' | 'remarks' | 'creditPaid' | 'outstanding' | 'settlementMethod' | 'settlementDate' | 'companyBrand' | 'isUdaro' | 'udaroDueDate' | 'udaroSettledDate' | 'createdAt' | 'updatedAt'> {}

class ChargingSession extends Model<ChargingSessionAttributes, ChargingSessionCreationAttributes> implements ChargingSessionAttributes {
  public id!: string;
  public tenantId!: string;
  public date!: Date;
  public time?: string;
  public vehicleNo!: string;
  public arrivalSoc?: number; // Optional
  public departureSoc?: number; // Optional
  public chargedPercent?: number; // Optional
  public ratePerPercent?: number; // Optional
  public chargeAmount!: number;
  public visitNo!: number;
  public chargerType!: string;
  public paymentMethod!: string;
  public paymentStatus!: string;
  public sessionStatus!: string;
  public operator?: string;
  public remarks?: string;
  public usedKwh!: number;
  public electricityRate!: number;
  public electricityCost!: number;
  public netContribution!: number;
  public creditPaid?: number;
  public outstanding?: number;
  public settlementMethod?: string;
  public settlementDate?: Date;
  public companyBrand?: string;
  public isUdaro?: boolean;
  public udaroDueDate?: Date;
  public udaroSettledDate?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChargingSession.init(
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    time: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    vehicleNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    arrivalSoc: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true, // Made optional
      validate: {
        min: 0,
        max: 100,
      },
    },
    departureSoc: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true, // Optional
      validate: {
        min: 0,
        max: 100,
      },
    },
    chargedPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true, // Optional
    },
    ratePerPercent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true, // Made optional
      validate: {
        min: 0,
      },
    },
    chargeAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    visitNo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    chargerType: {
      type: DataTypes.ENUM('GBT', 'CCS2'),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM('Cash', 'Bank/QR', 'Credit'),
      allowNull: false,
    },
    paymentStatus: {
      type: DataTypes.ENUM('Paid', 'Pending', 'Partially Paid'),
      allowNull: false,
      defaultValue: 'Pending', // Changed default to Pending (Unpaid)
    },
    sessionStatus: {
      type: DataTypes.ENUM('ongoing', 'completed', 'pending_payment'),
      allowNull: false,
      defaultValue: 'ongoing',
      comment: 'ongoing: currently charging, pending_payment: charging done awaiting payment, completed: fully done',
    },
    operator: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    usedKwh: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    electricityRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 17.00,
    },
    electricityCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    netContribution: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    creditPaid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    outstanding: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    settlementMethod: {
      type: DataTypes.ENUM('Cash', 'Bank/QR'),
      allowNull: true,
    },
    settlementDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    companyBrand: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isUdaro: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'True if this transaction is under a Settlement (Udaro) credit arrangement',
    },
    udaroDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Due date for the Udaro settlement payment',
    },
    udaroSettledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date when the Udaro settlement was fully paid',
    },
  },
  {
    sequelize,
    tableName: 'charging_sessions',
    timestamps: true,
    indexes: [
      {
        fields: ['tenantId'],
      },
      {
        fields: ['vehicleNo'],
      },
      {
        fields: ['date'],
      },
      {
        fields: ['paymentStatus'],
      },
      {
        fields: ['sessionStatus'],
      },
      {
        fields: ['chargerType'],
      },
      {
        fields: ['tenantId', 'vehicleNo'],
      },
    ],
  }
);

export default ChargingSession;
