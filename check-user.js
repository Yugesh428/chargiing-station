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
  }
});

const User = sequelize.define('user', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: DataTypes.STRING(100),
  email: DataTypes.STRING(255),
  password: DataTypes.STRING(255),
  role: DataTypes.ENUM('super_admin', 'tenant_admin', 'operator'),
  fullName: DataTypes.STRING(255),
  isActive: DataTypes.BOOLEAN,
}, {
  tableName: 'users',
  timestamps: true,
});

async function checkUser() {
  try {
    const user = await User.findOne({ where: { username: 'superadmin' } });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:');
    console.log('  Username:', user.username);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Active:', user.isActive);
    console.log('  Password hash:', user.password);
    
    // Test password
    const testPassword = 'Admin@123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log('\n🔐 Password test:');
    console.log('  Testing password:', testPassword);
    console.log('  Result:', isValid ? '✅ VALID' : '❌ INVALID');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
