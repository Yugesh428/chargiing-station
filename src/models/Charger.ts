import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ChargerStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

interface ChargerAttributes {
  id: string;
  tenantId: string;
  categoryId: string; // Foreign key to ChargerCategory
  chargerId: string; // Unique identifier e.g., "GBT-1", "CCS2-2"
  displayName: string; // User-friendly name
  location?: string; // Physical location description
  status: ChargerStatus;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  installationDate?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  notes?: string;
  metadata?: Record<string, any>; // Additional flexible data
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ChargerCreationAttributes
  extends Optional<
    ChargerAttributes,
    | 'id'
    | 'location'
    | 'serialNumber'
    | 'manufacturer'
    | 'model'
    | 'installationDate'
    | 'lastMaintenanceDate'
    | 'nextMaintenanceDate'
    | 'notes'
    | 'metadata'
    | 'createdAt'
    | 'updatedAt'
  > {}

class Charger
  extends Model<ChargerAttributes, ChargerCreationAttributes>
  implements ChargerAttributes
{
  public id!: string;
  public tenantId!: string;
  public categoryId!: string;
  public chargerId!: string;
  public displayName!: string;
  public location?: string;
  public status!: ChargerStatus;
  public serialNumber?: string;
  public manufacturer?: string;
  public model?: string;
  public installationDate?: Date;
  public lastMaintenanceDate?: Date;
  public nextMaintenanceDate?: Date;
  public notes?: string;
  public metadata?: Record<string, any>;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Charger.init(
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
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'charger_categories',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Reference to charger category (e.g., GBT, CCS2)',
    },
    chargerId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Unique charger identifier (e.g., GBT-1, CCS2-2)',
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'User-friendly display name',
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Physical location description',
    },
    status: {
      type: DataTypes.ENUM('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE'),
      allowNull: false,
      defaultValue: 'AVAILABLE',
      comment: 'Current operational status',
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Manufacturer serial number',
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Equipment manufacturer',
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Equipment model number',
    },
    installationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date when charger was installed',
    },
    lastMaintenanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Last maintenance date',
    },
    nextMaintenanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Scheduled next maintenance date',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes or remarks',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional flexible metadata as JSON',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this charger is active in the system',
    },
  },
  {
    sequelize,
    tableName: 'chargers',
    timestamps: true,
    indexes: [
      {
        fields: ['tenantId'],
      },
      {
        fields: ['categoryId'],
      },
      {
        fields: ['chargerId'],
      },
      {
        fields: ['status'],
      },
      {
        unique: true,
        fields: ['tenantId', 'chargerId'],
        name: 'chargers_tenant_charger_id_unique',
      },
    ],
  }
);

export default Charger;
