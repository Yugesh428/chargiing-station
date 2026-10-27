require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  logging: false,
});

async function fixVehicleData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Query to find and fix sessions with NULL or 0 chargeAmount
    const [sessions] = await sequelize.query(`
      SELECT id, "vehicleNo", date, "chargeAmount", "creditPaid", outstanding, 
             "arrivalSoc", "departureSoc", "chargedPercent", "ratePerPercent"
      FROM charging_sessions
      WHERE "chargeAmount" IS NULL OR "chargeAmount" = 0
      ORDER BY date DESC
      LIMIT 10;
    `);

    console.log(`\n📊 Found ${sessions.length} sessions with NULL or 0 chargeAmount`);
    
    if (sessions.length > 0) {
      console.log('\nSample data:');
      sessions.forEach(s => {
        console.log(`  Vehicle: ${s.vehicleNo}, Date: ${s.date}, ChargeAmount: ${s.chargeAmount}, CreditPaid: ${s.creditPaid}, Outstanding: ${s.outstanding}`);
      });

      console.log('\n⚠️  WARNING: These sessions need proper chargeAmount values!');
      console.log('Options to fix:');
      console.log('1. If you have arrivalSoc, departureSoc, and ratePerPercent, we can calculate chargeAmount');
      console.log('2. You need to manually enter chargeAmount for each session');
      console.log('\nRun this query to see sessions that CAN be auto-calculated:');
      console.log('SELECT COUNT(*) FROM charging_sessions WHERE ("chargeAmount" IS NULL OR "chargeAmount" = 0) AND "arrivalSoc" IS NOT NULL AND "departureSoc" IS NOT NULL AND "ratePerPercent" IS NOT NULL;');
    }

    // Check sessions that CAN be auto-calculated
    const [calculable] = await sequelize.query(`
      SELECT id, "vehicleNo", "arrivalSoc", "departureSoc", "ratePerPercent"
      FROM charging_sessions
      WHERE ("chargeAmount" IS NULL OR "chargeAmount" = 0)
        AND "arrivalSoc" IS NOT NULL 
        AND "departureSoc" IS NOT NULL 
        AND "ratePerPercent" IS NOT NULL;
    `);

    if (calculable.length > 0) {
      console.log(`\n✅ Found ${calculable.length} sessions that CAN be auto-calculated`);
      console.log('Fixing now...');

      for (const session of calculable) {
        const chargedPercent = parseFloat(session.departureSoc) - parseFloat(session.arrivalSoc);
        const chargeAmount = chargedPercent * parseFloat(session.ratePerPercent);

        await sequelize.query(`
          UPDATE charging_sessions
          SET "chargeAmount" = :chargeAmount,
              "chargedPercent" = :chargedPercent,
              "outstanding" = :chargeAmount - COALESCE("creditPaid", 0)
          WHERE id = :id
        `, {
          replacements: { 
            chargeAmount: chargeAmount.toFixed(2), 
            chargedPercent: chargedPercent.toFixed(2),
            id: session.id 
          }
        });

        console.log(`  ✓ Fixed ${session.vehicleNo}: ${chargedPercent.toFixed(2)}% × Rs.${session.ratePerPercent} = Rs.${chargeAmount.toFixed(2)}`);
      }

      console.log(`\n✅ Fixed ${calculable.length} sessions!`);
    }

    // Now update outstanding for all sessions to ensure consistency
    console.log('\n🔄 Updating outstanding amounts for all sessions...');
    await sequelize.query(`
      UPDATE charging_sessions
      SET outstanding = COALESCE("chargeAmount", 0) - COALESCE("creditPaid", 0)
      WHERE "chargeAmount" IS NOT NULL AND "chargeAmount" > 0;
    `);
    console.log('✅ Outstanding amounts updated!');

    // Final report
    const [finalCheck] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "chargeAmount" IS NULL OR "chargeAmount" = 0 THEN 1 END) as null_or_zero,
        COUNT(CASE WHEN "chargeAmount" > 0 THEN 1 END) as valid
      FROM charging_sessions;
    `);

    console.log('\n📊 Final Status:');
    console.log(`  Total Sessions: ${finalCheck[0].total}`);
    console.log(`  Valid (chargeAmount > 0): ${finalCheck[0].valid}`);
    console.log(`  NULL or Zero: ${finalCheck[0].null_or_zero}`);

    if (finalCheck[0].null_or_zero > 0) {
      console.log('\n⚠️  You still have sessions with NULL/0 chargeAmount');
      console.log('Please edit these sessions in the UI to add the correct charge amount.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

fixVehicleData();
