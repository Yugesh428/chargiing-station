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

    console.log('\n🔄 Adding sessionStatus column to charging_sessions table...');

    // Add sessionStatus column with ENUM type
    await sequelize.query(`
      DO $$ 
      BEGIN
        -- Create ENUM type if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_charging_sessions_sessionStatus') THEN
          CREATE TYPE "enum_charging_sessions_sessionStatus" AS ENUM ('ongoing', 'completed', 'pending_payment');
        END IF;

        -- Add column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'charging_sessions' 
          AND column_name = 'sessionStatus'
        ) THEN
          ALTER TABLE charging_sessions 
          ADD COLUMN "sessionStatus" "enum_charging_sessions_sessionStatus" DEFAULT 'completed' NOT NULL;
          
          -- Add comment
          COMMENT ON COLUMN charging_sessions."sessionStatus" IS 'ongoing: currently charging, pending_payment: charging done awaiting payment, completed: fully done';
        END IF;
      END $$;
    `);

    console.log('✅ Column added successfully');

    console.log('\n🔄 Creating index on sessionStatus...');
    
    // Create index if it doesn't exist
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "charging_sessions_sessionStatus" 
      ON charging_sessions ("sessionStatus");
    `);

    console.log('✅ Index created successfully');

    console.log('\n🔄 Updating existing sessions to "completed" status...');
    
    // Update all existing sessions to completed (they're already done)
    const [results] = await sequelize.query(`
      UPDATE charging_sessions 
      SET "sessionStatus" = 'completed' 
      WHERE "sessionStatus" IS NULL 
      RETURNING id;
    `);

    console.log(`✅ Updated ${results.length} existing sessions to "completed"`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Added sessionStatus ENUM column');
    console.log('   - Created index for fast filtering');
    console.log(`   - Updated ${results.length} existing records`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
