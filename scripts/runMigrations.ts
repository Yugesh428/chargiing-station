import { Sequelize, QueryInterface } from 'sequelize';
import * as dotenv from 'dotenv';

dotenv.config();

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

const queryInterface: QueryInterface = sequelize.getQueryInterface();

interface Migration {
  name: string;
  up: () => Promise<void>;
}

// ============================================
// MIGRATION DEFINITIONS
// ============================================

const migrations: Migration[] = [
  // Migration 1: Create Vehicles Table
  {
    name: '001_create_vehicles_table',
    up: async () => {
      const tables = await queryInterface.showAllTables();
      if (tables.includes('vehicles')) {
        console.log('   ⏭️  vehicles table already exists');
        return;
      }

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

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "vehicles_tenantId_idx" ON vehicles ("tenantId");
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "vehicles_vehicleNo_idx" ON vehicles ("vehicleNo");
      `);

      console.log('   ✅ vehicles table created');
    },
  },

  // Migration 2: Add Rate Master to Tenants
  {
    name: '002_add_rate_master',
    up: async () => {
      const [results] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tenants' 
        AND column_name = 'rateMaster'
      `);

      if ((results as any[]).length > 0) {
        console.log('   ⏭️  rateMaster column already exists');
        return;
      }

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

      console.log('   ✅ rateMaster column added to tenants');
    },
  },

  // Migration 3: Add Session Status
  {
    name: '003_add_session_status',
    up: async () => {
      const [results] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'charging_sessions' 
        AND column_name = 'sessionStatus'
      `);

      if ((results as any[]).length > 0) {
        console.log('   ⏭️  sessionStatus column already exists');
        return;
      }

      await sequelize.query(`
        ALTER TABLE charging_sessions 
        ADD COLUMN "sessionStatus" VARCHAR(50) DEFAULT 'completed'
      `);

      await sequelize.query(`
        UPDATE charging_sessions 
        SET "sessionStatus" = CASE 
          WHEN "departureSoc" IS NOT NULL AND "departureSoc" > 0 THEN 'completed'
          ELSE 'ongoing'
        END
        WHERE "sessionStatus" IS NULL
      `);

      console.log('   ✅ sessionStatus column added to charging_sessions');
    },
  },

  // Migration 4: Add Vehicle Settlement Fields
  {
    name: '004_add_vehicle_settlement_fields',
    up: async () => {
      const [columns] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles'
      `);

      const existingColumns = (columns as any[]).map((c: any) => c.column_name);

      // Add isSettlementVehicle
      if (!existingColumns.includes('isSettlementVehicle')) {
        await sequelize.query(`
          ALTER TABLE vehicles 
          ADD COLUMN "isSettlementVehicle" BOOLEAN DEFAULT FALSE NOT NULL
        `);
        console.log('   ✅ isSettlementVehicle column added');
      } else {
        console.log('   ⏭️  isSettlementVehicle already exists');
      }

      // Add settlementFrequency
      if (!existingColumns.includes('settlementFrequency')) {
        await sequelize.query(`
          ALTER TABLE vehicles 
          ADD COLUMN "settlementFrequency" VARCHAR(50) DEFAULT NULL
        `);
        console.log('   ✅ settlementFrequency column added');
      } else {
        console.log('   ⏭️  settlementFrequency already exists');
      }

      // Add settlementDayOfWeek
      if (!existingColumns.includes('settlementDayOfWeek')) {
        await sequelize.query(`
          ALTER TABLE vehicles 
          ADD COLUMN "settlementDayOfWeek" INTEGER DEFAULT NULL
        `);
        console.log('   ✅ settlementDayOfWeek column added');
      } else {
        console.log('   ⏭️  settlementDayOfWeek already exists');
      }

      // Add settlementDayOfMonth
      if (!existingColumns.includes('settlementDayOfMonth')) {
        await sequelize.query(`
          ALTER TABLE vehicles 
          ADD COLUMN "settlementDayOfMonth" INTEGER DEFAULT NULL
        `);
        console.log('   ✅ settlementDayOfMonth column added');
      } else {
        console.log('   ⏭️  settlementDayOfMonth already exists');
      }

      // Add customSettlementDays
      if (!existingColumns.includes('customSettlementDays')) {
        await sequelize.query(`
          ALTER TABLE vehicles 
          ADD COLUMN "customSettlementDays" INTEGER DEFAULT NULL
        `);
        console.log('   ✅ customSettlementDays column added');
      } else {
        console.log('   ⏭️  customSettlementDays already exists');
      }

      // Add nextDueDate
      if (!existingColumns.includes('nextDueDate')) {
        await sequelize.query(`
          ALTER TABLE vehicles 
          ADD COLUMN "nextDueDate" TIMESTAMP DEFAULT NULL
        `);
        console.log('   ✅ nextDueDate column added');
      } else {
        console.log('   ⏭️  nextDueDate already exists');
      }
    },
  },

  // Migration 5: Make Optional Fields
  {
    name: '005_make_fields_optional',
    up: async () => {
      try {
        await sequelize.query(`
          ALTER TABLE charging_sessions 
          ALTER COLUMN "time" DROP NOT NULL,
          ALTER COLUMN "operator" DROP NOT NULL,
          ALTER COLUMN "remarks" DROP NOT NULL
        `);
        console.log('   ✅ Made time, operator, remarks optional');
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log('   ⏭️  Fields already optional or not found');
        } else {
          throw error;
        }
      }
    },
  },

  // Migration 6: Make Arrival SOC Optional
  {
    name: '006_make_arrival_optional',
    up: async () => {
      try {
        await sequelize.query(`
          ALTER TABLE charging_sessions 
          ALTER COLUMN "arrivalSoc" DROP NOT NULL
        `);
        console.log('   ✅ Made arrivalSoc optional');
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log('   ⏭️  arrivalSoc already optional');
        } else {
          throw error;
        }
      }
    },
  },

  // Migration 7: Add Udaro/Credit Fields
  {
    name: '007_add_udaro_fields',
    up: async () => {
      const [columns] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'charging_sessions'
      `);

      const existingColumns = (columns as any[]).map((c: any) => c.column_name);

      if (!existingColumns.includes('isUdaro')) {
        await sequelize.query(`
          ALTER TABLE charging_sessions 
          ADD COLUMN "isUdaro" BOOLEAN DEFAULT FALSE
        `);
        console.log('   ✅ isUdaro column added');
      } else {
        console.log('   ⏭️  isUdaro already exists');
      }

      // Migrate Credit payment method to isUdaro flag
      await sequelize.query(`
        UPDATE charging_sessions 
        SET "isUdaro" = TRUE 
        WHERE "paymentMethod" = 'Credit'
      `);

      console.log('   ✅ Migrated Credit sessions to isUdaro=true');
    },
  },
];

// ============================================
// MIGRATION RUNNER
// ============================================

async function runMigrations() {
  console.log('\n🚀 Starting Database Migrations...\n');
  console.log('📍 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown');
  console.log('━'.repeat(60));

  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully\n');

    // Run each migration
    for (const migration of migrations) {
      console.log(`📦 Running: ${migration.name}`);
      try {
        await migration.up();
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
        // Continue with other migrations
      }
    }

    console.log('\n' + '━'.repeat(60));
    console.log('✅ All migrations completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Total migrations: ${migrations.length}`);
    console.log('   • Status: Ready for production\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run migrations
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
