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

// Define User model
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

async function createNewAdmin() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected!\n');

    // Get the first tenant
    const [tenants] = await sequelize.query('SELECT id, "stationName" FROM tenants LIMIT 1');
    
    if (tenants.length === 0) {
      console.log('❌ No tenant found. Please create a tenant first.');
      process.exit(1);
    }

    const tenant = tenants[0];
    console.log(`📍 Found tenant: ${tenant.stationName}`);

    // Create new admin credentials
    const newAdminEmail = 'zylo_admin@zylo-ev.com';
    const newAdminUsername = 'zylo_admin';
    const newAdminPassword = 'Zylo@2026';
    const newAdminFullName = 'Zylo Administrator';

    // Check if admin already exists
    const existingUser = await User.findOne({
      where: { email: newAdminEmail }
    });

    if (existingUser) {
      console.log('\n⚠️  Admin already exists!');
      console.log('📧 Email:', newAdminEmail);
      console.log('🔑 Password:', newAdminPassword);
      console.log('\n🌐 Login at: http://localhost:3000');
      process.exit(0);
    }

    console.log('\n👤 Creating new admin...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newAdminPassword, salt);

    await User.create({
      tenantId: tenant.id,
      username: newAdminUsername,
      email: newAdminEmail,
      password: hashedPassword,
      role: 'tenant_admin',
      fullName: newAdminFullName,
      isActive: true,
    });

    console.log('\n✅ ========================================');
    console.log('✅  NEW ADMIN CREATED SUCCESSFULLY!');
    console.log('✅ ========================================\n');
    console.log('📝 New Admin Login Credentials:');
    console.log('   Email:', newAdminEmail);
    console.log('   Username:', newAdminUsername);
    console.log('   Password:', newAdminPassword);
    console.log('\n🌐 Login URL: http://localhost:3000');
    console.log('\n⚠️  Save these credentials securely!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createNewAdmin();
