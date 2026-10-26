import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: string;
  tenantId?: string;
  username: string;
  email: string;
  password: string;
  role: 'super_admin' | 'tenant_admin' | 'operator';
  fullName: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    'id' | 'tenantId' | 'lastLogin' | 'createdAt' | 'updatedAt'
  > {}

// ✅ No public class fields - avoids Sequelize getter/setter shadowing issue
class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: string;
  declare tenantId: string | undefined;
  declare username: string;
  declare email: string;
  declare password: string;
  declare role: 'super_admin' | 'tenant_admin' | 'operator';
  declare fullName: string;
  declare isActive: boolean;
  declare lastLogin: Date | undefined;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Instance method to compare passwords
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.getDataValue('password'));
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'tenants',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'tenant_admin', 'operator'),
      allowNull: false,
      defaultValue: 'operator',
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['username'] },
      { unique: true, fields: ['email'] },
      { fields: ['tenantId'] },
      { fields: ['role'] },
    ],
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.getDataValue('password')) {
          const salt = await bcrypt.genSalt(12);
          user.setDataValue(
            'password',
            await bcrypt.hash(user.getDataValue('password'), salt)
          );
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(12);
          user.setDataValue(
            'password',
            await bcrypt.hash(user.getDataValue('password'), salt)
          );
        }
      },
    },
  }
);

export default User;
