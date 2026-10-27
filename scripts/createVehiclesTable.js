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
  logging: console.log,
});

async function migrate() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected successfully');

    console.log('\n🔄 Creating vehicles table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "vehicleNo" VARCHAR(50) NOT NULL,
        "companyBrand" VARCHAR(100),
        "ownerName" VARCHAR(200),
        "ownerContact" VARCHAR(50),
        notes TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "vehicles_tenantId_vehicleNo_unique" UNIQUE ("tenantId", "vehicleNo")
      );
    `);

    console.log('✅ vehicles table created (or already exists)');

    console.log('\n🔄 Creating indexes...');

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "vehicles_tenantId_idx" ON vehicles ("tenantId");
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "vehicles_vehicleNo_idx" ON vehicles ("vehicleNo");
    `);

    console.log('✅ Indexes created');

    // Count existing vehicles
    const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) as count FROM vehicles;`);
    console.log(`\n📊 vehicles table now has ${count} records`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
