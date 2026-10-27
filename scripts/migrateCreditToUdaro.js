const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function migrateCreditToUdaro() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Migrate existing Credit payment sessions to isUdaro
    const [result1] = await sequelize.query(`
      UPDATE charging_sessions 
      SET "isUdaro" = true 
      WHERE "paymentMethod" = 'Credit';
    `);
    console.log(`✓ Marked ${result1.length || 0} sessions as Udaro (isUdaro=true)`);

    // For unpaid Credit sessions, clear the paymentMethod
    const [result2] = await sequelize.query(`
      UPDATE charging_sessions 
      SET "paymentMethod" = 'Cash'
      WHERE "paymentMethod" = 'Credit' AND "paymentStatus" != 'Paid';
    `);
    console.log(`✓ Updated ${result2.length || 0} unpaid Credit sessions to paymentMethod=Cash`);

    // For paid Credit sessions, just set to Cash
    const [result3] = await sequelize.query(`
      UPDATE charging_sessions 
      SET "paymentMethod" = 'Cash'
      WHERE "paymentMethod" = 'Credit' AND "paymentStatus" = 'Paid';
    `);
    console.log(`✓ Updated ${result3.length || 0} paid Credit sessions to Cash`);

    console.log('\n✅ Migration complete!');
    console.log('   Credit payment method has been converted to Udaro flag');

    await sequelize.close();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateCreditToUdaro();
