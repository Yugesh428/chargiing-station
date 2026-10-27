const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
});

async function fix() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected');

    // Fix sessions where outstanding is 0 or NULL but paymentStatus is Pending or Partially Paid
    const [results] = await sequelize.query(`
      UPDATE charging_sessions
      SET
        outstanding = GREATEST(0, "chargeAmount" - COALESCE("creditPaid", 0)),
        "updatedAt" = NOW()
      WHERE
        "paymentStatus" IN ('Pending', 'Partially Paid')
        AND (outstanding IS NULL OR outstanding = 0)
        AND "chargeAmount" > 0
      RETURNING id, "vehicleNo", "chargeAmount", "creditPaid", outstanding, "paymentStatus";
    `);

    console.log(`✅ Fixed ${results.length} sessions`);
    if (results.length > 0) {
      console.log('\nFixed sessions:');
      results.forEach(r => {
        console.log(`  ${r.vehicleNo} | chargeAmount: ${r.chargeAmount} | creditPaid: ${r.creditPaid} | outstanding: ${r.outstanding} | status: ${r.paymentStatus}`);
      });
    }

    // Also fix sessions where creditPaid is NULL — set to 0
    const [[{ count }]] = await sequelize.query(`
      UPDATE charging_sessions
      SET "creditPaid" = 0, "updatedAt" = NOW()
      WHERE "creditPaid" IS NULL
      RETURNING id;
    `);

    console.log(`\n✅ Done. All outstanding values corrected.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fix();
