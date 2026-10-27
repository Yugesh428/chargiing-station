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
    const [rows] = await seq.query(`
      SELECT id, "vehicleNo", "chargeAmount", "creditPaid", outstanding, "paymentStatus", "sessionStatus"
      FROM charging_sessions
      ORDER BY "createdAt" DESC
      LIMIT 10
    `);
    console.log('Latest 10 sessions:');
    rows.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) {
    console.error(e.message);
  } finally {
    await seq.close();
  }
}
run();
