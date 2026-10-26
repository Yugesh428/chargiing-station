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

async function addRateMaster() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Check if column exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' 
      AND column_name = 'rateMaster'
    `);

    if (results.length > 0) {
      console.log('⚠️  rateMaster column already exists');
      process.exit(0);
    }

    console.log('📝 Adding rateMaster column to tenants table...');

    // Add rateMaster column with default value
    await sequelize.query(`
      ALTER TABLE tenants 
      ADD COLUMN "rateMaster" JSONB DEFAULT '[
        {"label":"6","value":6},
        {"label":"7","value":7},
        {"label":"8","value":8},
        {"label":"9","value":9},
        {"label":"10","value":10},
        {"label":"11","value":11},
        {"label":"12","value":12},
        {"label":"13","value":13}
      ]'::jsonb
    `);

    console.log('✅ Added rateMaster column');

    // Update existing tenants to have the default rate master
    await sequelize.query(`
      UPDATE tenants 
      SET "rateMaster" = '[
        {"label":"6","value":6},
        {"label":"7","value":7},
        {"label":"8","value":8},
        {"label":"9","value":9},
        {"label":"10","value":10},
        {"label":"11","value":11},
        {"label":"12","value":12},
        {"label":"13","value":13}
      ]'::jsonb
      WHERE "rateMaster" IS NULL
    `);

    console.log('✅ Updated existing tenants with default rate master');
    console.log('✅ Migration completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addRateMaster();
