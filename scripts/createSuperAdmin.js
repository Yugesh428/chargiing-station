require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Try DATABASE_URL first, then fall back to individual params
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 10000
      },
      retry: {
        max: 3
      }
    })
  : new Sequelize(
      process.env.DB_NAME || 'postgres',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 60000,
          idle: 10000
        }
      }
    );

// Define models with UUIDs
const Tenant = sequelize.define('tenant', {
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
  },
  phone: DataTypes.STRING(50),
  address: DataTypes.TEXT,
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  subscriptionStatus: {
    type: DataTypes.ENUM('trial', 'active', 'suspended', 'cancelled'),
    defaultValue: 'trial',
  },
  subscriptionExpiry: DataTypes.DATE,
  electricityRate: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 17.00,
  },
  monthlyStaffCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 25000.00,
  },
  monthlyRent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 15000.00,
  },
  otherFixedCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 1300.00,
  },
  defaultPaymentStatus: {
    type: DataTypes.STRING(50),
    defaultValue: 'Paid',
  },
  neaCostRate: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 9.35,
  },
}, {
  tableName: 'tenants',
  timestamps: true,
});

const User = sequelize.define('user', {
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
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'tenant_admin', 'operator'),
    defaultValue: 'operator',
  },
  fullName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastLogin: DataTypes.DATE,
}, {
  tableName: 'users',
  timestamps: true,
});

const ChargingSession = sequelize.define('charging_session', {
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
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  time: DataTypes.STRING(20),
  vehicleNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  arrivalSoc: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  departureSoc: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  chargedPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  ratePerPercent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  chargeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  visitNo: {
    type: DataTypes.INTEGER,
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
    defaultValue: 'Paid',
  },
  operator: DataTypes.STRING(100),
  remarks: DataTypes.TEXT,
  usedKwh: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
  },
  electricityRate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
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
    defaultValue: 0,
  },
  outstanding: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  settlementMethod: {
    type: DataTypes.ENUM('Cash', 'Bank/QR'),
    allowNull: true,
  },
  settlementDate: DataTypes.DATE,
  companyBrand: DataTypes.STRING(100),
}, {
  tableName: 'charging_sessions',
  timestamps: true,
});

const Expense = sequelize.define('expense', {
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
  },
  paidTo: DataTypes.STRING(255),
  voucherRef: DataTypes.STRING(100),
  remarks: DataTypes.TEXT,
}, {
  tableName: 'expenses',
  timestamps: true,
});

// Define associations
User.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(User, { foreignKey: 'tenantId' });
ChargingSession.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(ChargingSession, { foreignKey: 'tenantId' });
Expense.belongsTo(Tenant, { foreignKey: 'tenantId' });
Tenant.hasMany(Expense, { foreignKey: 'tenantId' });

async function createSuperAdmin() {
  try {
    console.log('🔌 Connecting to database...');
    console.log(`📍 Using DATABASE_URL: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
    
    if (process.env.DATABASE_URL) {
      // Parse and show connection details (hide password)
      const url = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
      console.log(`🔗 Connection: ${url}`);
    } else {
      console.log(`📍 Host: ${process.env.DB_HOST}`);
      console.log(`📂 Database: ${process.env.DB_NAME}`);
      console.log(`👤 User: ${process.env.DB_USER}`);
    }
    
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.\n');

    console.log('📋 Creating/Syncing database tables...');
    await sequelize.sync({ alter: true });
    console.log('✅ Tables created/synced successfully.\n');

    console.log('👤 Checking for existing super admin...');
    const existingSuperAdmin = await User.findOne({
      where: { role: 'super_admin' },
    });

    if (existingSuperAdmin) {
      console.log('ℹ️  Super admin already exists!');
      console.log('📧 Email:', existingSuperAdmin.email);
      console.log('👤 Username:', existingSuperAdmin.username);
      console.log('\n✨ You can login with these credentials.\n');
      process.exit(0);
    }

    console.log('🔐 Creating super admin account...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const superAdmin = await User.create({
      username: 'superadmin',
      email: 'admin@lekali-ev.com',
      password: hashedPassword,
      role: 'super_admin',
      fullName: 'Super Administrator',
      isActive: true,
    });

    console.log('\n✅ ========================================');
    console.log('✅  SUPER ADMIN CREATED SUCCESSFULLY! ');
    console.log('✅ ========================================\n');
    console.log('📝 Login credentials:');
    console.log('   Username: superadmin');
    console.log('   Password: Admin@123');
    console.log('   Email: admin@lekali-ev.com');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\n🌐 Start the application:');
    console.log('   npm run dev');
    console.log('\n🔗 Then visit: http://localhost:3000\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.parent) {
      console.error('💥 Database Error:', error.parent.message);
    }
    process.exit(1);
  }
}

createSuperAdmin();
