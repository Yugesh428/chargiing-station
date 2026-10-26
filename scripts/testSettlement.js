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

    // Find sessions for vehicle 1234
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
      LIMIT 5
    `);

    console.log('📋 Sessions for vehicle 1234 (BEFORE settlement):');
    sessions.forEach((s, idx) => {
      console.log(`\n${idx + 1}. Session ID: ${s.id.substring(0, 8)}...`);
      console.log(`   Date: ${s.date}`);
      console.log(`   Charge Amount: Rs. ${parseFloat(s.chargeAmount).toFixed(2)}`);
      console.log(`   Credit Paid: Rs. ${parseFloat(s.creditPaid || 0).toFixed(2)}`);
      console.log(`   Outstanding: Rs. ${parseFloat(s.outstanding || 0).toFixed(2)}`);
      console.log(`   Payment Status: ${s.paymentStatus}`);
      console.log(`   Settlement Method: ${s.settlementMethod || 'NULL'}`);
      console.log(`   Settlement Date: ${s.settlementDate || 'NULL'}`);
    });

    if (sessions.length === 0) {
      console.log('\n❌ No sessions found for vehicle 1234');
      await sequelize.close();
      process.exit(0);
    }

    // Pick the first session with outstanding > 0
    const sessionToSettle = sessions.find(s => parseFloat(s.outstanding || 0) > 0);
    
    if (!sessionToSettle) {
      console.log('\n❌ No sessions with outstanding amount found for vehicle 1234');
      await sequelize.close();
      process.exit(0);
    }

    const sessionId = sessionToSettle.id;
    const chargeAmount = parseFloat(sessionToSettle.chargeAmount);
    const partialPayment = 30; // Pay Rs. 30

    console.log(`\n\n💰 SIMULATING SETTLEMENT:`);
    console.log(`   Session ID: ${sessionId.substring(0, 8)}...`);
    console.log(`   Charge Amount: Rs. ${chargeAmount.toFixed(2)}`);
    console.log(`   Paying: Rs. ${partialPayment.toFixed(2)}`);
    console.log(`   Expected Outstanding After: Rs. ${(chargeAmount - partialPayment).toFixed(2)}`);

    // Perform settlement
    await sequelize.query(`
      UPDATE charging_sessions
      SET 
        "creditPaid" = ${partialPayment},
        outstanding = ${chargeAmount - partialPayment},
        "paymentStatus" = 'Partially Paid',
        "settlementMethod" = 'Cash',
        "settlementDate" = NOW()
      WHERE id = '${sessionId}'
    `);

    console.log('\n✅ Settlement executed');

    // Verify the update
    const [updated] = await sequelize.query(`
      SELECT 
        id,
        "vehicleNo",
        "chargeAmount", 
        "creditPaid", 
        outstanding, 
        "paymentStatus",
        "settlementMethod",
        "settlementDate"
      FROM charging_sessions 
      WHERE id = '${sessionId}'
    `);

    const s = updated[0];
    console.log('\n📋 Session AFTER settlement:');
    console.log(`   Session ID: ${s.id.substring(0, 8)}...`);
    console.log(`   Vehicle: ${s.vehicleNo}`);
    console.log(`   Charge Amount: Rs. ${parseFloat(s.chargeAmount).toFixed(2)}`);
    console.log(`   Credit Paid: Rs. ${parseFloat(s.creditPaid || 0).toFixed(2)}`);
    console.log(`   Outstanding: Rs. ${parseFloat(s.outstanding || 0).toFixed(2)}`);
    console.log(`   Payment Status: ${s.paymentStatus}`);
    console.log(`   Settlement Method: ${s.settlementMethod || 'NULL'}`);
    console.log(`   Settlement Date: ${s.settlementDate ? new Date(s.settlementDate).toISOString().slice(0, 10) : 'NULL'}`);

    // Verify the calculation
    const expectedOutstanding = chargeAmount - partialPayment;
    const actualOutstanding = parseFloat(s.outstanding);
    
    if (Math.abs(expectedOutstanding - actualOutstanding) < 0.01) {
      console.log('\n✅ Outstanding calculation is CORRECT!');
    } else {
      console.log('\n❌ Outstanding calculation is WRONG!');
      console.log(`   Expected: Rs. ${expectedOutstanding.toFixed(2)}`);
      console.log(`   Actual: Rs. ${actualOutstanding.toFixed(2)}`);
    }

    console.log('\n🔄 Now refresh your browser to see the updated values in the UI');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

testSettlement();
