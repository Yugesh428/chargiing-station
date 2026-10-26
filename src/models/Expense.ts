import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ExpenseAttributes {
  id: string;
  tenantId: string;
  date: Date;
  expenseType: string;
  description: string;
  paymentMethod: string;
  amount: number;
  paidTo?: string;
  voucherRef?: string;
  remarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ExpenseCreationAttributes extends Optional<ExpenseAttributes, 'id' | 'paidTo' | 'voucherRef' | 'remarks' | 'createdAt' | 'updatedAt'> {}

class Expense extends Model<ExpenseAttributes, ExpenseCreationAttributes> implements ExpenseAttributes {
  public id!: string;
  public tenantId!: string;
  public date!: Date;
  public expenseType!: string;
  public description!: string;
  public paymentMethod!: string;
  public amount!: number;
  public paidTo?: string;
  public voucherRef?: string;
  public remarks?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Expense.init(
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
    expenseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM('Cash', 'Bank/QR', 'Credit', 'Bank Transfer'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    paidTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    voucherRef: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'expenses',
    timestamps: true,
    indexes: [
      {
        fields: ['tenantId'],
      },
      {
        fields: ['date'],
      },
      {
        fields: ['expenseType'],
      },
      {
        fields: ['tenantId', 'date'],
      },
    ],
  }
);

export default Expense;
