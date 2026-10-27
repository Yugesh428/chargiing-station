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
  logging: false,
});

async function testSettlement() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Find session for vehicle 1234 that was settled
    const [sessions] = await sequelize.query(`
      SELECT 
        id, 
        "vehicleNo", 
        date,
        "chargeAmount", 
        "creditPaid", 
        outstanding, 
        "paymentStatus",
        "settlementMethod",
        "settlementDate"
      FROM charging_sessions 
      WHERE "vehicleNo" = '1234'
      ORDER BY date DESC
      LIMIT 1
    `);

    if (sessions.length === 0) {
      console.log('❌ No sessions found for vehicle 1234');
      await sequelize.close();
      process.exit(0);
    }

    const s = sessions[0];
    console.log('📋 Current data for vehicle 1234:');
    console.log(`   Vehicle: ${s.vehicleNo}`);
    console.log(`   Charge Amount: Rs. ${parseFloat(s.chargeAmount).toFixed(2)}`);
    console.log(`   Credit Paid: Rs. ${parseFloat(s.creditPaid || 0).toFixed(2)}`);
    console.log(`   Outstanding: Rs. ${parseFloat(s.outstanding || 0).toFixed(2)}`);
    console.log(`   Payment Status: ${s.paymentStatus}`);
    console.log(`   Settlement Method: ${s.settlementMethod || 'NULL'}`);
    console.log(`   Settlement Date: ${s.settlementDate ? new Date(s.settlementDate).toISOString().slice(0, 10) : 'NULL'}`);

    const outstanding = parseFloat(s.outstanding || 0);
    console.log(`\n🔍 Settle button logic:`);
    console.log(`   Outstanding > 0.01? ${outstanding > 0.01 ? 'YES' : 'NO'}`);
    console.log(`   Should show Settle button? ${outstanding > 0.01 ? 'YES ✅' : 'NO ❌'}`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

testSettlement();
