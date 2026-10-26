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

    console.log('\n🔄 Making arrivalSoc and ratePerPercent optional...');
    
    await sequelize.query(`
      ALTER TABLE charging_sessions 
      ALTER COLUMN "arrivalSoc" DROP NOT NULL,
      ALTER COLUMN "ratePerPercent" DROP NOT NULL;
    `);

    console.log('✅ Columns are now optional');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ arrivalSoc: Now optional (can be NULL)');
    console.log('   ✓ departureSoc: Already optional');
    console.log('   ✓ ratePerPercent: Now optional (can be NULL)');
    console.log('   ✓ chargedPercent: Already optional');
    console.log('\n🎯 Now you can create sessions with just: date, vehicleNo, chargerType');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
