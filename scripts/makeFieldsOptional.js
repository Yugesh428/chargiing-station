const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: console.log,
});

async function migrate() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected successfully');

    console.log('\n🔄 Making departureSoc and chargedPercent optional...');
    
    await sequelize.query(`
      ALTER TABLE charging_sessions 
      ALTER COLUMN "departureSoc" DROP NOT NULL,
      ALTER COLUMN "chargedPercent" DROP NOT NULL;
    `);

    console.log('✅ Columns are now optional');

    console.log('\n🔄 Changing default payment status to Pending...');
    
    await sequelize.query(`
      ALTER TABLE charging_sessions 
      ALTER COLUMN "paymentStatus" SET DEFAULT 'Pending';
    `);

    console.log('✅ Default payment status changed to Pending');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - departureSoc: Now optional (can be NULL)');
    console.log('   - chargedPercent: Now optional (can be NULL)');
    console.log('   - paymentStatus: Default changed to "Pending"');
    console.log('   - companyBrand: Already optional');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
