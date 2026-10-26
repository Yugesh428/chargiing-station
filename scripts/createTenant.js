require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
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

async function createTenant() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected!\n');

    // Check if Lekali tenant already exists
    const existingTenant = await Tenant.findOne({
      where: { email: 'lekali@lekali-ev.com' }
    });

    if (existingTenant) {
      console.log('ℹ️  Lekali EV tenant already exists!');
      console.log('📧 Station Name:', existingTenant.stationName);
      
      const admin = await User.findOne({
        where: { tenantId: existingTenant.id, role: 'tenant_admin' }
      });
      
      if (admin) {
        console.log('\n✅ Tenant Admin Login:');
        console.log('   Email:', admin.email);
        console.log('   Password: Admin@123');
        console.log('\n🌐 Login at: http://localhost:3000');
      }
      
      process.exit(0);
    }

    console.log('🏢 Creating Lekali EV Charging Station tenant...');

    // Create tenant
    const tenant = await Tenant.create({
      name: 'Lekali Pvt. Ltd.',
      stationName: 'Lekali EV Charging Station',
      email: 'lekali@lekali-ev.com',
      phone: '9851234567',
      address: 'Kathmandu, Nepal',
      isActive: true,
      subscriptionStatus: 'active',
      electricityRate: 17.00,
      neaCostRate: 9.35,
      monthlyStaffCost: 25000.00,
      monthlyRent: 15000.00,
      otherFixedCost: 1300.00,
      defaultPaymentStatus: 'Paid',
    });

    console.log('✅ Tenant created!');
    console.log('   ID:', tenant.id);
    console.log('   Station:', tenant.stationName);

    // Create admin user
    console.log('\n👤 Creating tenant admin...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const admin = await User.create({
      tenantId: tenant.id,
      username: 'lekali_admin',
      email: 'lekali_admin@lekali-ev.com',
      password: hashedPassword,
      role: 'tenant_admin',
      fullName: 'Lekali Administrator',
      isActive: true,
    });

    console.log('✅ Admin created!');
    console.log('   Username:', admin.username);
    console.log('   Email:', admin.email);

    console.log('\n✅ ========================================');
    console.log('✅  TENANT & ADMIN CREATED SUCCESSFULLY!');
    console.log('✅ ========================================\n');
    console.log('🏢 Station: Lekali EV Charging Station');
    console.log('\n📝 Tenant Admin Login:');
    console.log('   Email: lekali_admin@lekali-ev.com');
    console.log('   Password: Admin@123');
    console.log('\n🌐 Login URL: http://localhost:3000');
    console.log('\n⚡ Now you can:');
    console.log('   • Create charging sessions');
    console.log('   • Manage vehicles');
    console.log('   • View reports');
    console.log('   • Add expenses');
    console.log('   • Configure settings\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.parent) {
      console.error('💥 Database Error:', error.parent.message);
    }
    process.exit(1);
  }
}

createTenant();
