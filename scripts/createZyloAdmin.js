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

const User = sequelize.define('user', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: true,
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

async function createZyloAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected!\n');

    // Get Zylo tenant
    const [tenants] = await sequelize.query(`SELECT id, "stationName" FROM tenants WHERE "stationName" = 'Zylo EV Charging Station' LIMIT 1`);
    
    if (tenants.length === 0) {
      console.log('❌ Zylo tenant not found. Run "npm run create:zylo" first.');
      process.exit(1);
    }

    const tenant = tenants[0];
    console.log(`📍 Found tenant: ${tenant.stationName}`);
    console.log(`🆔 Tenant ID: ${tenant.id}\n`);

    // Create admin
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

    console.log('✅ ========================================');
    console.log('✅  ZYLO ADMIN CREATED SUCCESSFULLY!');
    console.log('✅ ========================================\n');
    console.log('📝 Login Credentials:');
    console.log('   Email: admin@zylo-station.com');
    console.log('   Username: zylo_station_admin');
    console.log('   Password: Zylo@2026');
    console.log('\n🌐 Login URL: http://localhost:3000');
    console.log('\n✨ This admin manages a SEPARATE tenant!');
    console.log('   No shared data with other admins.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

createZyloAdmin();
