const { Sequelize } = require('sequelize');
require('dotenv').config();

const seq = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
});

async function run() {
  try {
    await seq.authenticate();

    // Fix sessions marked Paid but still have outstanding > 0
    const [fixed] = await seq.query(`
      UPDATE charging_sessions
      SET
        outstanding = 0,
        "creditPaid" = "chargeAmount",
        "sessionStatus" = 'completed',
        "updatedAt" = NOW()
      WHERE "paymentStatus" = 'Paid'
        AND outstanding > 0
      RETURNING id, "vehicleNo", "chargeAmount"
    `);
    console.log(`Fixed ${fixed.length} Paid sessions with outstanding > 0:`);
    fixed.forEach(r => console.log(`  ${r.vehicleNo} chargeAmount=${r.chargeAmount}`));

    // Show all remaining non-paid with actual amount
    const [remaining] = await seq.query(`
      SELECT id, "vehicleNo", "chargeAmount", "creditPaid", outstanding, "paymentStatus"
      FROM charging_sessions
      WHERE "paymentStatus" != 'Paid'
        AND "chargeAmount" > 0
    `);
    console.log(`\nActual unpaid sessions (${remaining.length}):`);
    remaining.forEach(r => console.log(`  ${JSON.stringify(r)}`));
  } catch(e) {
    console.error(e.message);
  } finally {
    await seq.close();
  }
}
run();
