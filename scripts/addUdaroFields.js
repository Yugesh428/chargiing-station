const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function addUdaroFields() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Add isUdaro field to track if session is under settlement arrangement
    try {
      await sequelize.query(`
        ALTER TABLE charging_sessions 
        ADD COLUMN IF NOT EXISTS "isUdaro" BOOLEAN DEFAULT false;
      `);
      console.log('✓ Added isUdaro column');
    } catch (err) {
      console.log('isUdaro column may already exist:', err.message);
    }

    // Add udaroDueDate to track when settlement payment is due
    try {
      await sequelize.query(`
        ALTER TABLE charging_sessions 
        ADD COLUMN IF NOT EXISTS "udaroDueDate" DATE;
      `);
      console.log('✓ Added udaroDueDate column');
    } catch (err) {
      console.log('udaroDueDate column may already exist:', err.message);
    }

    // Add udaroSettledDate to track when settlement was fully paid
    try {
      await sequelize.query(`
        ALTER TABLE charging_sessions 
        ADD COLUMN IF NOT EXISTS "udaroSettledDate" DATE;
      `);
      console.log('✓ Added udaroSettledDate column');
    } catch (err) {
      console.log('udaroSettledDate column may already exist:', err.message);
    }

    // Update paymentMethod enum to remove 'Credit' (it was confusing)
    // Credit was being used to indicate Udaro, but it should be a separate flag
    console.log('\n⚠️  NOTE: paymentMethod="Credit" should no longer be used.');
    console.log('   Use isUdaro=true instead to mark settlement transactions.');
    console.log('   paymentMethod should only be: Cash, Bank/QR (or null if unpaid)');

    // Check for existing sessions using Credit payment method
    const [creditSessions] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM charging_sessions 
      WHERE "paymentMethod" = 'Credit';
    `);
    
    if (creditSessions[0].count > 0) {
      console.log(`\n⚠️  Found ${creditSessions[0].count} sessions with paymentMethod='Credit'`);
      console.log('   These should be migrated to use isUdaro=true instead.');
      
      // Ask for confirmation to migrate
      console.log('\n   To migrate these automatically, run:');
      console.log('   UPDATE charging_sessions SET "isUdaro" = true WHERE "paymentMethod" = \'Credit\';');
      console.log('   UPDATE charging_sessions SET "paymentMethod" = NULL WHERE "paymentMethod" = \'Credit\' AND "paymentStatus" != \'Paid\';');
    }

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Update ChargingSession model to include new fields');
    console.log('2. Update session creation to use isUdaro flag');
    console.log('3. Separate Settlement page logic from Pending Payments');

    await sequelize.close();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

addUdaroFields();
