import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ChargerCategoryAttributes {
  id: string;
  tenantId: string;
  name: string; // e.g., "GBT", "CCS2", "Type 2", "CHAdeMO"
  displayName: string; // e.g., "GBT Fast Charger", "CCS2 DC Fast Charger"
  description?: string;
  powerOutput?: number; // in kW, e.g., 60, 120, 150
  connectorType?: string; // e.g., "DC", "AC"
  voltage?: number; // e.g., 400V, 800V
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ChargerCategoryCreationAttributes
  extends Optional<
    ChargerCategoryAttributes,
    'id' | 'description' | 'powerOutput' | 'connectorType' | 'voltage' | 'createdAt' | 'updatedAt'
  > {}

class ChargerCategory
  extends Model<ChargerCategoryAttributes, ChargerCategoryCreationAttributes>
  implements ChargerCategoryAttributes
{
  public id!: string;
  public tenantId!: string;
  public name!: string;
  public displayName!: string;
  public description?: string;
  public powerOutput?: number;
  public connectorType?: string;
  public voltage?: number;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChargerCategory.init(
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
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Short name/code (e.g., GBT, CCS2)',
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'User-friendly display name',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed description of the charger category',
    },
    powerOutput: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Power output in kW (e.g., 60, 120, 150)',
    },
    connectorType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Connector type (e.g., DC, AC)',
    },
    voltage: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Operating voltage (e.g., 400, 800)',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this category is currently active',
    },
  },
  {
    sequelize,
    tableName: 'charger_categories',
    timestamps: true,
    indexes: [
      {
        fields: ['tenantId'],
      },
      {
        fields: ['name'],
      },
      {
        unique: true,
        fields: ['tenantId', 'name'],
        name: 'charger_categories_tenant_name_unique',
      },
    ],
  }
);

export default ChargerCategory;
