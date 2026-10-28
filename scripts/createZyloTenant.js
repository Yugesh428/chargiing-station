const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

// Define models
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
    defaultValue: 'active',
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
  rateMaster: {
    type: DataTypes.JSONB,
    defaultValue: [
      {"label":"6","value":6},
      {"label":"7","value":7},
      {"label":"8","value":8},
      {"label":"9","value":9},
      {"label":"10","value":10},
      {"label":"11","value":11},
      {"label":"12","value":12},
      {"label":"13","value":13}
    ],
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

async function createZyloTenant() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected!\n');

    // Check if Zylo tenant already exists
    const existingTenant = await Tenant.findOne({
      where: { email: 'zylo@zylo-ev.com' }
    });

    if (existingTenant) {
      console.log('ℹ️  Zylo EV tenant already exists!');
      console.log('📧 Station Name:', existingTenant.stationName);
      
      const admin = await User.findOne({
        where: { tenantId: existingTenant.id, role: 'tenant_admin' }
      });
      
      if (admin) {
        console.log('\n✅ Tenant Admin Login:');
        console.log('   Email:', admin.email);
        console.log('   Password: Zylo@2026');
        console.log('\n🌐 Login at: http://localhost:3000');
      }
      
      process.exit(0);
    }

    console.log('🏢 Creating Zylo EV Charging Station tenant...');

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Zylo Technologies Pvt. Ltd.',
      stationName: 'Zylo EV Charging Station',
      email: 'zylo@zylo-ev.com',
      phone: '9841234567',
      address: 'Kathmandu, Nepal',
      isActive: true,
      subscriptionStatus: 'active',
      electricityRate: 17.00,
      neaCostRate: 9.35,
      monthlyStaffCost: 30000.00,
      monthlyRent: 20000.00,
      otherFixedCost: 2000.00,
      defaultPaymentStatus: 'Paid',
      rateMaster: [
        {"label":"6","value":6},
        {"label":"7","value":7},
        {"label":"8","value":8},
        {"label":"9","value":9},
        {"label":"10","value":10},
        {"label":"11","value":11},
        {"label":"12","value":12},
        {"label":"13","value":13}
      ],
    });

    console.log('✅ Tenant created!');
    console.log('   ID:', tenant.id);
    console.log('   Station:', tenant.stationName);

    // Create admin user
    console.log('\n👤 Creating tenant admin...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Zylo@2026', salt);

    const admin = await User.create({
      tenantId: tenant.id,
      username: 'zylo_station_admin',
      email: 'admin@zylo-station.com',
      password: hashedPassword,
      role: 'tenant_admin',
      fullName: 'Zylo Station Administrator',
      isActive: true,
    });

    console.log('✅ Admin created!');
    console.log('   Username:', admin.username);
    console.log('   Email:', admin.email);

    console.log('\n✅ ========================================');
    console.log('✅  ZYLO TENANT & ADMIN CREATED!');
    console.log('✅ ========================================\n');
    console.log('🏢 Station: Zylo EV Charging Station');
    console.log('\n📝 Tenant Admin Login:');
    console.log('   Email: admin@zylo-station.com');
    console.log('   Username: zylo_station_admin');
    console.log('   Password: Zylo@2026');
    console.log('\n🌐 Login URL: http://localhost:3000');
    console.log('\n✨ This is a completely separate tenant with its own data!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.parent) {
      console.error('💥 Database Error:', error.parent.message);
    }
    process.exit(1);
  }
}

createZyloTenant();
