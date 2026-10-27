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
    console.log('Connected\n');

    // Fix 1: Sessions that are Paid but sessionStatus is not 'completed'
    const [fixed1] = await seq.query(`
      UPDATE charging_sessions
      SET "sessionStatus" = 'completed', "updatedAt" = NOW()
      WHERE "paymentStatus" = 'Paid'
        AND "sessionStatus" != 'completed'
      RETURNING id, "vehicleNo", "paymentStatus", "sessionStatus"
    `);
    console.log(`Fixed ${fixed1.length} Paid sessions with wrong sessionStatus`);
    fixed1.forEach(r => console.log(`  ${r.vehicleNo} -> sessionStatus set to completed`));

    // Fix 2: Sessions that are Pending with chargeAmount=0 — mark sessionStatus as 'ongoing' (they're empty/test sessions)
    const [fixed2] = await seq.query(`
      UPDATE charging_sessions
      SET "sessionStatus" = 'ongoing', "updatedAt" = NOW()
      WHERE "paymentStatus" = 'Pending'
        AND "chargeAmount" = 0
        AND "sessionStatus" != 'ongoing'
      RETURNING id, "vehicleNo"
    `);
    console.log(`\nFixed ${fixed2.length} empty Pending sessions -> sessionStatus = ongoing`);

    // Show final state
    const [remaining] = await seq.query(`
      SELECT "vehicleNo", "chargeAmount", "creditPaid", outstanding, "paymentStatus", "sessionStatus"
      FROM charging_sessions
      WHERE "paymentStatus" != 'Paid'
        AND "chargeAmount" > 0
      ORDER BY "createdAt" DESC
    `);
    console.log(`\nRemaining unpaid sessions with actual charges (${remaining.length}):`);
    remaining.forEach(r => console.log(`  ${JSON.stringify(r)}`));

    console.log('\nDone.');
  } catch(e) {
    console.error(e.message);
  } finally {
    await seq.close();
  }
}
run();
