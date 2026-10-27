import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface VehicleAttributes {
  id: string;
  tenantId: string;
  vehicleNo: string;
  companyBrand?: string;
  ownerName?: string;
  ownerContact?: string;
  notes?: string;
  settlementFrequency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface VehicleCreationAttributes extends Optional<VehicleAttributes, 'id' | 'companyBrand' | 'ownerName' | 'ownerContact' | 'notes' | 'settlementFrequency' | 'createdAt' | 'updatedAt'> {}

class Vehicle extends Model<VehicleAttributes, VehicleCreationAttributes> implements VehicleAttributes {
  public id!: string;
  public tenantId!: string;
  public vehicleNo!: string;
  public companyBrand?: string;
  public ownerName?: string;
  public ownerContact?: string;
  public notes?: string;
  public settlementFrequency?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Vehicle.init(
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
    vehicleNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    companyBrand: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ownerName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    ownerContact: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    settlementFrequency: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'monthly',
    },
  },
  {
    sequelize,
    tableName: 'vehicles',
    timestamps: true,
    indexes: [
      {
        fields: ['tenantId'],
      },
      {
        fields: ['vehicleNo'],
      },
      {
        unique: true,
        fields: ['tenantId', 'vehicleNo'],
      },
    ],
  }
);

export default Vehicle;
