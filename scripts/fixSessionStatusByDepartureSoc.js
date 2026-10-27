/**
 * Migration: Fix Session Status Based on Departure SOC
 * 
 * NEW RULE: Session status is determined ONLY by Departure SOC:
 * - departureSoc is NULL/empty → sessionStatus = 'ongoing'
 * - departureSoc is filled → sessionStatus = 'completed'
 * 
 * Payment status is separate from session status
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Use DATABASE_URL if available, otherwise construct from individual vars
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
    console.log('🔄 Starting session status migration based on Departure SOC...\n');

    // Get all sessions
    const [sessions] = await sequelize.query(`
      SELECT id, "vehicleNo", "departureSoc", "sessionStatus", "paymentStatus"
      FROM charging_sessions
      ORDER BY date DESC
    `);

    console.log(`📊 Found ${sessions.length} total sessions\n`);

    let ongoingCount = 0;
    let completedCount = 0;
    let unchangedCount = 0;
    let updatedSessions = [];

    for (const session of sessions) {
      const departureSoc = session.departureSoc;
      const currentStatus = session.sessionStatus;
      
      // Apply new rule: departureSoc determines session status
      let newStatus;
      if (departureSoc === null || departureSoc === undefined || departureSoc === '') {
        newStatus = 'ongoing';
      } else {
        newStatus = 'completed';
      }

      // Update if status changed
      if (currentStatus !== newStatus) {
        await sequelize.query(`
          UPDATE charging_sessions
          SET "sessionStatus" = :newStatus
          WHERE id = :id
        `, {
          replacements: { newStatus, id: session.id }
        });

        updatedSessions.push({
          id: session.id,
          vehicleNo: session.vehicleNo,
          departureSoc: session.departureSoc,
          oldStatus: currentStatus,
          newStatus: newStatus,
          paymentStatus: session.paymentStatus
        });

        if (newStatus === 'ongoing') {
          ongoingCount++;
        } else {
          completedCount++;
        }
      } else {
        unchangedCount++;
      }
    }

    console.log('✅ Migration Summary:');
    console.log(`   • ${updatedSessions.length} sessions updated`);
    console.log(`   • ${ongoingCount} marked as ongoing (departureSoc NULL)`);
    console.log(`   • ${completedCount} marked as completed (departureSoc filled)`);
    console.log(`   • ${unchangedCount} sessions unchanged\n`);

    if (updatedSessions.length > 0) {
      console.log('📝 Updated Sessions (first 20):');
      updatedSessions.slice(0, 20).forEach(s => {
        console.log(`   ${s.vehicleNo}: ${s.oldStatus} → ${s.newStatus} (departureSoc: ${s.departureSoc ?? 'NULL'}, payment: ${s.paymentStatus})`);
      });
      
      if (updatedSessions.length > 20) {
        console.log(`   ... and ${updatedSessions.length - 20} more`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📌 NEW RULE APPLIED:');
    console.log('   • departureSoc = NULL → sessionStatus = ongoing');
    console.log('   • departureSoc = filled → sessionStatus = completed');
    console.log('   • Payment status is now separate from session status');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
