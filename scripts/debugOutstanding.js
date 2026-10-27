const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
});

async function debug() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Show all non-Paid sessions with their outstanding values
    const [rows] = await sequelize.query(`
      SELECT
        id, "vehicleNo", "chargeAmount", "creditPaid", outstanding,
        "paymentStatus", "sessionStatus", "createdAt"
      FROM charging_sessions
      WHERE "paymentStatus" != 'Paid'
      ORDER BY "createdAt" DESC
      LIMIT 20;
    `);

    console.log(`Found ${rows.length} non-Paid sessions:\n`);
    rows.forEach(r => {
      const calc = parseFloat(r.chargeAmount) - parseFloat(r.creditPaid || 0);
      console.log(`  vehicleNo: ${r.vehicleNo}`);
      console.log(`    chargeAmount: ${r.chargeAmount}, creditPaid: ${r.creditPaid}, outstanding (DB): ${r.outstanding}`);
      console.log(`    calculated outstanding: ${calc.toFixed(2)}`);
      console.log(`    paymentStatus: ${r.paymentStatus}, sessionStatus: ${r.sessionStatus}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

debug();
