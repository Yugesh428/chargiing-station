/**
 * Migration: Add Settlement Fields to Vehicles Table
 * 
 * Allows owner to register vehicles with settlement arrangements (weekly/monthly payment schedules)
 * Sessions for these vehicles will automatically be marked as Udaro/Settlement
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
      }
    );

async function migrate() {
  try {
    console.log('🔄 Adding settlement fields to vehicles table...\n');

    // Check if columns exist
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles'
    `);

    const existingColumns = columns.map(c => c.column_name);

    // Add isSettlementVehicle
    if (!existingColumns.includes('isSettlementVehicle')) {
      await sequelize.query(`
        ALTER TABLE vehicles 
        ADD COLUMN "isSettlementVehicle" BOOLEAN DEFAULT FALSE NOT NULL
      `);
      console.log('✅ Added isSettlementVehicle column');
    } else {
      console.log('⏭️  isSettlementVehicle column already exists');
    }

    // Update existing settlementFrequency to allow NULL
    await sequelize.query(`
      ALTER TABLE vehicles 
      ALTER COLUMN "settlementFrequency" DROP NOT NULL,
      ALTER COLUMN "settlementFrequency" DROP DEFAULT
    `);
    console.log('✅ Updated settlementFrequency to allow NULL');

    // Add settlementDayOfWeek
    if (!existingColumns.includes('settlementDayOfWeek')) {
      await sequelize.query(`
        ALTER TABLE vehicles 
        ADD COLUMN "settlementDayOfWeek" INTEGER DEFAULT NULL
      `);
      console.log('✅ Added settlementDayOfWeek column');
    } else {
      console.log('⏭️  settlementDayOfWeek column already exists');
    }

    // Add settlementDayOfMonth
    if (!existingColumns.includes('settlementDayOfMonth')) {
      await sequelize.query(`
        ALTER TABLE vehicles 
        ADD COLUMN "settlementDayOfMonth" INTEGER DEFAULT NULL
      `);
      console.log('✅ Added settlementDayOfMonth column');
    } else {
      console.log('⏭️  settlementDayOfMonth column already exists');
    }

    // Add customSettlementDays
    if (!existingColumns.includes('customSettlementDays')) {
      await sequelize.query(`
        ALTER TABLE vehicles 
        ADD COLUMN "customSettlementDays" INTEGER DEFAULT NULL
      `);
      console.log('✅ Added customSettlementDays column');
    } else {
      console.log('⏭️  customSettlementDays column already exists');
    }

    // Add nextDueDate
    if (!existingColumns.includes('nextDueDate')) {
      await sequelize.query(`
        ALTER TABLE vehicles 
        ADD COLUMN "nextDueDate" TIMESTAMP DEFAULT NULL
      `);
      console.log('✅ Added nextDueDate column');
    } else {
      console.log('⏭️  nextDueDate column already exists');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📌 New Vehicle Settlement Fields:');
    console.log('   • isSettlementVehicle: Mark vehicles on settlement arrangement');
    console.log('   • settlementFrequency: weekly, biweekly, monthly, custom');
    console.log('   • settlementDayOfWeek: For weekly (0=Sunday, 6=Saturday)');
    console.log('   • settlementDayOfMonth: For monthly (1-31)');
    console.log('   • customSettlementDays: For custom frequency');
    console.log('   • nextDueDate: Calculated next payment due date');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
