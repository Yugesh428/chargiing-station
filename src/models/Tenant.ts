import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TenantAttributes {
  id: string;
  name: string;
  stationName: string;
  email: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  subscriptionStatus: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscriptionExpiry?: Date;
  electricityRate: number;
  monthlyStaffCost: number;
  monthlyRent: number;
  otherFixedCost: number;
  defaultPaymentStatus: string;
  neaCostRate: number;
  rateMaster?: Record<string, number>; // e.g., { "Rate A": 6, "Rate B": 7, ... }
  createdAt?: Date;
  updatedAt?: Date;
}

interface TenantCreationAttributes extends Optional<TenantAttributes, 'id' | 'phone' | 'address' | 'subscriptionExpiry' | 'createdAt' | 'updatedAt'> {}

class Tenant extends Model<TenantAttributes, TenantCreationAttributes> implements TenantAttributes {
  public id!: string;
  public name!: string;
  public stationName!: string;
  public email!: string;
  public phone?: string;
  public address?: string;
  public isActive!: boolean;
  public subscriptionStatus!: 'trial' | 'active' | 'suspended' | 'cancelled';
  public subscriptionExpiry?: Date;
  public electricityRate!: number;
  public monthlyStaffCost!: number;
  public monthlyRent!: number;
  public otherFixedCost!: number;
  public defaultPaymentStatus!: string;
  public neaCostRate!: number;
  public rateMaster?: Record<string, number>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Tenant.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    stationName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    subscriptionStatus: {
      type: DataTypes.ENUM('trial', 'active', 'suspended', 'cancelled'),
      allowNull: false,
      defaultValue: 'trial',
    },
    subscriptionExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    electricityRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 17.00,
    },
    monthlyStaffCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 25000.00,
    },
    monthlyRent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 15000.00,
    },
    otherFixedCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1300.00,
    },
    defaultPaymentStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Paid',
    },
    neaCostRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 9.35,
    },
    rateMaster: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        '6': 6,
        '7': 7,
        '8': 8,
        '9': 9,
        '10': 10,
        '11': 11,
        '12': 12,
        '13': 13,
      },
      comment: 'Dynamic rate master: { "label": value, ... } e.g. { "6": 6, "7": 7, "custom": 15 }',
    },
  },
  {
    sequelize,
    tableName: 'tenants',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
    ],
  }
);

export default Tenant;
