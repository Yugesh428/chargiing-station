const { Sequelize, DataTypes } = require('sequelize');
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

async function fixOutstanding() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    console.log('📝 Fixing outstanding amounts based on payment status...');

    // LOGIC:
    // If paymentStatus = 'Paid' → outstanding = 0, creditPaid = chargeAmount
    // If paymentStatus = 'Pending' → outstanding = chargeAmount - creditPaid
    // If paymentStatus = 'Partially Paid' → outstanding = chargeAmount - creditPaid

    // Fix sessions marked as "Paid" but have outstanding
    await sequelize.query(`
      UPDATE charging_sessions 
      SET 
        "creditPaid" = COALESCE("chargeAmount", 0),
        outstanding = 0
      WHERE "paymentStatus" = 'Paid'
    `);

    console.log('✅ Fixed sessions with Paid status');

    // Fix sessions marked as "Pending" or "Partially Paid"
    await sequelize.query(`
      UPDATE charging_sessions 
      SET 
        "creditPaid" = COALESCE("creditPaid", 0),
        outstanding = COALESCE("chargeAmount", 0) - COALESCE("creditPaid", 0)
      WHERE "paymentStatus" IN ('Pending', 'Partially Paid')
    `);

    console.log('✅ Fixed sessions with Pending/Partially Paid status');

    // Show summary
    const [results] = await sequelize.query(`
      SELECT 
        "paymentStatus",
        COUNT(*) as count,
        SUM("chargeAmount") as total_charge,
        SUM("creditPaid") as total_paid,
        SUM("outstanding") as total_outstanding
      FROM charging_sessions
      GROUP BY "paymentStatus"
      ORDER BY "paymentStatus"
    `);

    console.log('\n📊 Summary by Payment Status:');
    results.forEach(r => {
      console.log(`   ${r.paymentStatus}:`);
      console.log(`      Sessions: ${r.count}`);
      console.log(`      Total Charge: Rs. ${parseFloat(r.total_charge || 0).toFixed(2)}`);
      console.log(`      Total Paid: Rs. ${parseFloat(r.total_paid || 0).toFixed(2)}`);
      console.log(`      Total Outstanding: Rs. ${parseFloat(r.total_outstanding || 0).toFixed(2)}`);
    });

    console.log('\n✅ Migration completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixOutstanding();
