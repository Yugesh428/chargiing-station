/**
 * Centralized Database Migration System
 * 
 * This file consolidates ALL database migrations into a single, trackable system.
 * Migrations are executed in order and tracked to prevent re-execution.
 * 
 * Consolidated from 25+ individual migration scripts:
 * - Schema migrations (tables, columns, indexes)
 * - Settlement & Udaro features
 * - Data fixes and consistency updates
 * - Vehicle Queue Management System
 * 
 * Usage: npm run migrate
 */

import { Sequelize, QueryInterface, DataTypes } from 'sequelize';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================
// DATABASE CONNECTION
// ============================================

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

// ============================================
// MIGRATION TRACKING TABLE
// ============================================

async function ensureMigrationTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW(),
      execution_time_ms INTEGER,
      status VARCHAR(50) DEFAULT 'success',
      error_message TEXT
    );
  `);
}

async function isMigrationExecuted(name: string): Promise<boolean> {
  const [results] = await sequelize.query(
    `SELECT 1 FROM migration_history WHERE migration_name = ? AND status = 'success' LIMIT 1`,
    { replacements: [name] }
  );
  return (results as any[]).length > 0;
}

async function recordMigration(name: string, timeMs: number, status: 'success' | 'failed' = 'success', error?: string) {
  await sequelize.query(
    `INSERT INTO migration_history (migration_name, execution_time_ms, status, error_message) 
     VALUES (?, ?, ?, ?) 
     ON CONFLICT (migration_name) DO UPDATE 
     SET executed_at = NOW(), execution_time_ms = ?, status = ?, error_message = ?`,
    { replacements: [name, timeMs, status, error || null, timeMs, status, error || null] }
  );
}

// ============================================
// MIGRATION INTERFACE
// ============================================

interface Migration {
  name: string;
  description: string;
  up: () => Promise<void>;
  requiresTransaction?: boolean;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function columnExists(table: string, column: string): Promise<boolean> {
  const [results] = await sequelize.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = ? AND column_name = ?
  `, { replacements: [table, column] });
  return (results as any[]).length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const tables = await queryInterface.showAllTables();
  return tables.includes(table);
}

// ============================================
// MIGRATION DEFINITIONS
// ============================================

const migrations: Migration[] = [
  // ========== SCHEMA MIGRATIONS ==========
  
  {
    name: '001_create_vehicles_table',
    description: 'Create vehicles table for tracking vehicle information',
    up: async () => {
      if (await tableExists('vehicles')) {
        console.log('   ⏭️  Table already exists');
        return;
      }

      await sequelize.query(`
        CREATE TABLE vehicles (
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
        
        CREATE INDEX "vehicles_tenantId_idx" ON vehicles ("tenantId");
        CREATE INDEX "vehicles_vehicleNo_idx" ON vehicles ("vehicleNo");
      `);
      
      console.log('   ✅ Vehicles table created with indexes');
    },
  },

  {
    name: '002_add_rate_master_to_tenants',
    description: 'Add rateMaster JSONB column to tenants for configurable charging rates',
    up: async () => {
      if (await columnExists('tenants', 'rateMaster')) {
        console.log('   ⏭️  Column already exists');
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
        ]'::jsonb;
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
        WHERE "rateMaster" IS NULL;
      `);

      console.log('   ✅ rateMaster column added and populated');
    },
  },

  {
    name: '003_add_session_status',
    description: 'Add sessionStatus column to track ongoing/completed/pending_payment states',
    up: async () => {
      if (await columnExists('charging_sessions', 'sessionStatus')) {
        console.log('   ⏭️  Column already exists');
        return;
      }

      await sequelize.query(`
        ALTER TABLE charging_sessions 
        ADD COLUMN "sessionStatus" VARCHAR(50) DEFAULT 'completed';
      `);

      await sequelize.query(`
        UPDATE charging_sessions 
        SET "sessionStatus" = CASE 
          WHEN "departureSoc" IS NOT NULL AND "departureSoc" > 0 THEN 'completed'
          ELSE 'ongoing'
        END
        WHERE "sessionStatus" IS NULL;
      `);

      console.log('   ✅ sessionStatus column added and initialized');
    },
  },

  // ========== SETTLEMENT & VEHICLE MIGRATIONS ==========

  {
    name: '004_add_vehicle_settlement_fields',
    description: 'Add settlement tracking fields to vehicles table',
    up: async () => {
      const fieldsToAdd = [
        { name: 'isSettlementVehicle', type: 'BOOLEAN DEFAULT FALSE NOT NULL' },
        { name: 'settlementFrequency', type: 'VARCHAR(50) DEFAULT NULL' },
        { name: 'settlementDayOfWeek', type: 'INTEGER DEFAULT NULL' },
        { name: 'settlementDayOfMonth', type: 'INTEGER DEFAULT NULL' },
        { name: 'customSettlementDays', type: 'INTEGER DEFAULT NULL' },
        { name: 'nextDueDate', type: 'TIMESTAMP DEFAULT NULL' },
      ];

      for (const field of fieldsToAdd) {
        if (!(await columnExists('vehicles', field.name))) {
          await sequelize.query(`ALTER TABLE vehicles ADD COLUMN "${field.name}" ${field.type}`);
          console.log(`   ✅ Added ${field.name}`);
        } else {
          console.log(`   ⏭️  ${field.name} already exists`);
        }
      }
    },
  },

  {
    name: '005_add_udaro_settlement_fields',
    description: 'Add Udaro/settlement tracking fields to charging_sessions',
    up: async () => {
      const fieldsToAdd = [
        { name: 'isUdaro', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'udaroDueDate', type: 'DATE DEFAULT NULL' },
        { name: 'udaroSettledDate', type: 'DATE DEFAULT NULL' },
      ];

      for (const field of fieldsToAdd) {
        if (!(await columnExists('charging_sessions', field.name))) {
          await sequelize.query(`ALTER TABLE charging_sessions ADD COLUMN "${field.name}" ${field.type}`);
          console.log(`   ✅ Added ${field.name}`);
        } else {
          console.log(`   ⏭️  ${field.name} already exists`);
        }
      }
    },
  },

  // ========== FIELD OPTIONALITY MIGRATIONS ==========

  {
    name: '006_make_session_fields_optional',
    description: 'Make optional fields nullable in charging_sessions',
    up: async () => {
      const fieldsToMakeOptional = ['time', 'operator', 'remarks', 'arrivalSoc', 'departureSoc', 'chargedPercent'];
      
      for (const field of fieldsToMakeOptional) {
        try {
          await sequelize.query(`ALTER TABLE charging_sessions ALTER COLUMN "${field}" DROP NOT NULL`);
          console.log(`   ✅ Made ${field} optional`);
        } catch (error: any) {
          if (error.message.includes('does not exist') || error.message.includes('column is already nullable')) {
            console.log(`   ⏭️  ${field} already optional or doesn't exist`);
          } else {
            throw error;
          }
        }
      }

      // Change default payment status to Pending
      try {
        await sequelize.query(`ALTER TABLE charging_sessions ALTER COLUMN "paymentStatus" SET DEFAULT 'Pending'`);
        console.log('   ✅ Set default paymentStatus to Pending');
      } catch (error) {
        console.log('   ⏭️  Default already set');
      }
    },
  },

  // ========== DATA FIX MIGRATIONS ==========

  {
    name: '007_migrate_credit_to_udaro',
    description: 'Migrate legacy Credit payment method to isUdaro flag',
    up: async () => {
      const [creditSessions] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM charging_sessions 
        WHERE "paymentMethod" = 'Credit' AND "isUdaro" = FALSE;
      `);

      const count = (creditSessions as any[])[0]?.count || 0;
      
      if (count === 0) {
        console.log('   ⏭️  No Credit sessions to migrate');
        return;
      }

      // Mark all Credit sessions as Udaro
      await sequelize.query(`
        UPDATE charging_sessions 
        SET "isUdaro" = TRUE 
        WHERE "paymentMethod" = 'Credit';
      `);

      // Convert paymentMethod to Cash for unpaid Credit sessions
      await sequelize.query(`
        UPDATE charging_sessions 
        SET "paymentMethod" = 'Cash'
        WHERE "paymentMethod" = 'Credit' AND "paymentStatus" != 'Paid';
      `);

      // Convert paymentMethod to Cash for paid Credit sessions
      await sequelize.query(`
        UPDATE charging_sessions 
        SET "paymentMethod" = 'Cash'
        WHERE "paymentMethod" = 'Credit' AND "paymentStatus" = 'Paid';
      `);

      console.log(`   ✅ Migrated ${count} Credit sessions to isUdaro=true`);
    },
  },

  {
    name: '008_fix_outstanding_amounts',
    description: 'Recalculate outstanding amounts based on payment status',
    requiresTransaction: true,
    up: async () => {
      // Fix Paid sessions
      const [result1] = await sequelize.query(`
        UPDATE charging_sessions 
        SET 
          "creditPaid" = COALESCE("chargeAmount", 0),
          outstanding = 0
        WHERE "paymentStatus" = 'Paid' AND (outstanding != 0 OR outstanding IS NULL)
        RETURNING id;
      `);

      console.log(`   ✅ Fixed ${(result1 as any[]).length} Paid sessions`);

      // Fix Pending/Partially Paid sessions
      const [result2] = await sequelize.query(`
        UPDATE charging_sessions 
        SET 
          "creditPaid" = COALESCE("creditPaid", 0),
          outstanding = GREATEST(0, COALESCE("chargeAmount", 0) - COALESCE("creditPaid", 0))
        WHERE "paymentStatus" IN ('Pending', 'Partially Paid')
        RETURNING id;
      `);

      console.log(`   ✅ Fixed ${(result2 as any[]).length} Pending/Partially Paid sessions`);
    },
  },

  {
    name: '009_fix_session_status_consistency',
    description: 'Ensure sessionStatus matches paymentStatus',
    requiresTransaction: true,
    up: async () => {
      // Paid sessions should be completed
      const [result1] = await sequelize.query(`
        UPDATE charging_sessions
        SET "sessionStatus" = 'completed'
        WHERE "paymentStatus" = 'Paid' AND "sessionStatus" != 'completed'
        RETURNING id;
      `);

      console.log(`   ✅ Fixed ${(result1 as any[]).length} Paid sessions to completed`);

      // Empty sessions (chargeAmount=0) should be ongoing
      const [result2] = await sequelize.query(`
        UPDATE charging_sessions
        SET "sessionStatus" = 'ongoing'
        WHERE ("chargeAmount" IS NULL OR "chargeAmount" = 0) AND "sessionStatus" != 'ongoing'
        RETURNING id;
      `);

      console.log(`   ✅ Fixed ${(result2 as any[]).length} empty sessions to ongoing`);
    },
  },

  {
    name: '010_auto_calculate_missing_charge_amounts',
    description: 'Calculate chargeAmount for sessions with SOC and rate data',
    requiresTransaction: true,
    up: async () => {
      const [calculable] = await sequelize.query(`
        SELECT id, "arrivalSoc", "departureSoc", "ratePerPercent"
        FROM charging_sessions
        WHERE ("chargeAmount" IS NULL OR "chargeAmount" = 0)
          AND "arrivalSoc" IS NOT NULL 
          AND "departureSoc" IS NOT NULL 
          AND "ratePerPercent" IS NOT NULL
          AND "departureSoc" > "arrivalSoc";
      `);

      if ((calculable as any[]).length === 0) {
        console.log('   ⏭️  No sessions need auto-calculation');
        return;
      }

      for (const session of calculable as any[]) {
        const chargedPercent = parseFloat(session.departureSoc) - parseFloat(session.arrivalSoc);
        const chargeAmount = chargedPercent * parseFloat(session.ratePerPercent);

        await sequelize.query(`
          UPDATE charging_sessions
          SET 
            "chargeAmount" = ?,
            "chargedPercent" = ?,
            "outstanding" = ? - COALESCE("creditPaid", 0)
          WHERE id = ?
        `, {
          replacements: [
            chargeAmount.toFixed(2),
            chargedPercent.toFixed(2),
            chargeAmount.toFixed(2),
            session.id
          ]
        });
      }

      console.log(`   ✅ Auto-calculated ${(calculable as any[]).length} sessions`);
    },
  },

  {
    name: '011_update_all_outstanding_consistency',
    description: 'Final pass to ensure all outstanding amounts are correct',
    requiresTransaction: true,
    up: async () => {
      await sequelize.query(`
        UPDATE charging_sessions
        SET outstanding = GREATEST(0, COALESCE("chargeAmount", 0) - COALESCE("creditPaid", 0))
        WHERE "chargeAmount" IS NOT NULL AND "chargeAmount" > 0;
      `);

      console.log('   ✅ All outstanding amounts synchronized');
    },
  },

  // ========== VEHICLE QUEUE MANAGEMENT SYSTEM ==========

  {
    name: '012_create_vehicle_queue_table',
    description: 'Create vehicle queue management system with full staff audit tracking',
    up: async () => {
      if (await tableExists('vehicle_queue')) {
        console.log('   ⏭️  vehicle_queue table already exists');
        return;
      }

      // Create queue status enum type first
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE queue_status AS ENUM ('WAITING', 'CALLED', 'ASSIGNED', 'CANCELLED', 'LEFT', 'EXPIRED');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Create vehicle_queue table
      await sequelize.query(`
        CREATE TABLE vehicle_queue (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "vehicleId" UUID NOT NULL REFERENCES vehicles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          
          -- Queue Management
          "queuePosition" INTEGER NOT NULL DEFAULT 0,
          status queue_status NOT NULL DEFAULT 'WAITING',
          priority INTEGER NOT NULL DEFAULT 0,
          
          -- Timestamps
          "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "calledAt" TIMESTAMP WITH TIME ZONE,
          "assignedAt" TIMESTAMP WITH TIME ZONE,
          "cancelledAt" TIMESTAMP WITH TIME ZONE,
          
          -- Assignment Details
          "assignedChargerId" VARCHAR(50),
          "chargingSessionId" UUID REFERENCES charging_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL,
          
          -- Metadata
          "estimatedWaitingTime" INTEGER,
          notes TEXT,
          
          -- Audit Trail - Staff Tracking
          "createdBy" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          "updatedBy" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          "calledBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          "assignedBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          "cancelledBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          
          -- Standard Timestamps
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);

      // Create indexes
      await sequelize.query(`
        CREATE INDEX "idx_vehicle_queue_tenant_status" ON vehicle_queue ("tenantId", status);
      `);

      await sequelize.query(`
        CREATE INDEX "idx_vehicle_queue_tenant_vehicle" ON vehicle_queue ("tenantId", "vehicleId");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_vehicle_queue_session" ON vehicle_queue ("chargingSessionId");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_vehicle_queue_created_by" ON vehicle_queue ("createdBy");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_vehicle_queue_assigned_by" ON vehicle_queue ("assignedBy");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_vehicle_queue_position" ON vehicle_queue ("tenantId", status, priority, "queuePosition", "joinedAt");
      `);

      // Create partial unique constraint for active queue entries
      await sequelize.query(`
        CREATE UNIQUE INDEX "idx_vehicle_queue_unique_active" 
        ON vehicle_queue ("tenantId", "vehicleId") 
        WHERE status IN ('WAITING', 'CALLED');
      `);

      console.log('   ✅ vehicle_queue table created with indexes and constraints');
      console.log('   ✅ Staff audit tracking enabled (createdBy, calledBy, assignedBy, cancelledBy)');
    },
  },

  // ========== CHARGER MANAGEMENT SYSTEM ==========

  {
    name: '013_create_charger_categories_table',
    description: 'Create charger categories table for charger type management',
    up: async () => {
      if (await tableExists('charger_categories')) {
        console.log('   ⏭️  charger_categories table already exists');
        return;
      }

      await sequelize.query(`
        CREATE TABLE charger_categories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
          name VARCHAR(50) NOT NULL,
          "displayName" VARCHAR(100) NOT NULL,
          description TEXT,
          "powerOutput" DECIMAL(10, 2),
          "connectorType" VARCHAR(50),
          voltage INTEGER,
          "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          CONSTRAINT "charger_categories_tenant_name_unique" UNIQUE ("tenantId", name)
        );
      `);

      await sequelize.query(`
        CREATE INDEX "idx_charger_categories_tenant" ON charger_categories ("tenantId");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_charger_categories_name" ON charger_categories (name);
      `);

      console.log('   ✅ charger_categories table created with indexes');
    },
  },

  {
    name: '014_create_chargers_table',
    description: 'Create chargers table for individual charger unit management',
    up: async () => {
      if (await tableExists('chargers')) {
        console.log('   ⏭️  chargers table already exists');
        return;
      }

      // Create charger status enum
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE charger_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'OUT_OF_SERVICE');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await sequelize.query(`
        CREATE TABLE chargers (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "categoryId" UUID NOT NULL REFERENCES charger_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          "chargerId" VARCHAR(50) NOT NULL,
          "displayName" VARCHAR(100) NOT NULL,
          location VARCHAR(200),
          status charger_status NOT NULL DEFAULT 'AVAILABLE',
          "serialNumber" VARCHAR(100),
          manufacturer VARCHAR(100),
          model VARCHAR(100),
          "installationDate" DATE,
          "lastMaintenanceDate" DATE,
          "nextMaintenanceDate" DATE,
          notes TEXT,
          metadata JSONB,
          "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          CONSTRAINT "chargers_tenant_charger_id_unique" UNIQUE ("tenantId", "chargerId")
        );
      `);

      await sequelize.query(`
        CREATE INDEX "idx_chargers_tenant" ON chargers ("tenantId");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_chargers_category" ON chargers ("categoryId");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_chargers_charger_id" ON chargers ("chargerId");
      `);

      await sequelize.query(`
        CREATE INDEX "idx_chargers_status" ON chargers (status);
      `);

      console.log('   ✅ chargers table created with indexes and status enum');
    },
  },

  {
    name: '015_seed_default_charger_categories',
    description: 'Seed default charger categories (GBT, CCS2) for existing tenants',
    up: async () => {
      // Get all tenants
      const [tenants] = await sequelize.query(`SELECT id FROM tenants;`);

      if ((tenants as any[]).length === 0) {
        console.log('   ⏭️  No tenants found to seed charger categories');
        return;
      }

      for (const tenant of tenants as any[]) {
        // Check if categories already exist
        const [existing] = await sequelize.query(
          `SELECT COUNT(*) as count FROM charger_categories WHERE "tenantId" = ?`,
          { replacements: [tenant.id] }
        );

        if ((existing as any[])[0].count > 0) {
          console.log(`   ⏭️  Charger categories already exist for tenant ${tenant.id}`);
          continue;
        }

        // Insert GBT category
        await sequelize.query(`
          INSERT INTO charger_categories (
            "tenantId", name, "displayName", description, "powerOutput", "connectorType", "isActive"
          ) VALUES (
            ?, 'GBT', 'GBT Fast Charger', 'GB/T DC Fast Charging Standard', 60, 'DC', TRUE
          );
        `, { replacements: [tenant.id] });

        // Insert CCS2 category
        await sequelize.query(`
          INSERT INTO charger_categories (
            "tenantId", name, "displayName", description, "powerOutput", "connectorType", "isActive"
          ) VALUES (
            ?, 'CCS2', 'CCS2 Fast Charger', 'Combined Charging System Type 2', 120, 'DC', TRUE
          );
        `, { replacements: [tenant.id] });

        console.log(`   ✅ Seeded default charger categories for tenant ${tenant.id}`);
      }

      console.log('   ✅ Default charger categories seeded for all tenants');
    },
  },
];

// ============================================
// MIGRATION EXECUTOR
// ============================================

async function runMigrations() {
  const startTime = Date.now();
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     CENTRALIZED DATABASE MIGRATION SYSTEM                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📍 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown');
  console.log('📅 Started:', new Date().toLocaleString());
  console.log('━'.repeat(60));

  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully\n');

    // Ensure migration tracking table exists
    await ensureMigrationTable();
    console.log('✅ Migration tracking table ready\n');

    // Get list of pending migrations
    const pendingMigrations = [];
    for (const migration of migrations) {
      if (!(await isMigrationExecuted(migration.name))) {
        pendingMigrations.push(migration);
      }
    }

    if (pendingMigrations.length === 0) {
      console.log('✨ All migrations already executed! Database is up to date.\n');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s)\n`);

    // Execute pending migrations
    let successCount = 0;
    let failureCount = 0;

    for (const migration of pendingMigrations) {
      const migrationStart = Date.now();
      
      console.log(`📦 ${migration.name}`);
      console.log(`   ${migration.description}`);

      try {
        if (migration.requiresTransaction) {
          await sequelize.transaction(async () => {
            await migration.up();
          });
        } else {
          await migration.up();
        }

        const timeMs = Date.now() - migrationStart;
        await recordMigration(migration.name, timeMs, 'success');
        
        console.log(`   ⏱️  Completed in ${timeMs}ms\n`);
        successCount++;

      } catch (error: any) {
        const timeMs = Date.now() - migrationStart;
        console.error(`   ❌ Failed: ${error.message}`);
        console.error(`   Stack: ${error.stack}\n`);
        
        await recordMigration(migration.name, timeMs, 'failed', error.message);
        failureCount++;
        
        // Continue with other migrations even if one fails
        console.log('   ⚠️  Continuing with next migration...\n');
      }
    }

    // Summary
    const totalTime = Date.now() - startTime;
    console.log('━'.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('━'.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`📋 Total migrations: ${migrations.length}`);
    console.log(`🎯 Status: ${failureCount === 0 ? 'All migrations completed successfully!' : 'Some migrations failed - review logs above'}`);
    console.log('━'.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runMigrations, migrations };
