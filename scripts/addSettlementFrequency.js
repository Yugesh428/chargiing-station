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
    await seq.query(`
      ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS "settlementFrequency" VARCHAR(20) DEFAULT 'monthly';
    `);
    console.log('✅ Added settlementFrequency column to vehicles table');
  } catch(e) {
    console.error('❌', e.message);
  } finally {
    await seq.close();
  }
}
run();
