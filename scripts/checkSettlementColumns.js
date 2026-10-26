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
  logging: false,
});

async function checkColumns() {
  try {
    await sequelize.authenticate();
    
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'charging_sessions' 
      AND column_name IN ('settlementMethod', 'settlementDate', 'creditPaid', 'outstanding')
      ORDER BY column_name
    `);
    
    console.log('Settlement-related columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check if columns exist
    const hasSettlementMethod = columns.some(c => c.column_name === 'settlementMethod');
    const hasSettlementDate = columns.some(c => c.column_name === 'settlementDate');
    
    if (!hasSettlementMethod || !hasSettlementDate) {
      console.log('\n❌ Missing settlement columns! Need to add them.');
    } else {
      console.log('\n✅ All settlement columns exist');
      
      // Show sample data
      const [sample] = await sequelize.query(`
        SELECT 
          "vehicleNo",
          "chargeAmount",
          "creditPaid",
          "outstanding",
          "settlementMethod",
          "settlementDate",
          "paymentStatus"
        FROM charging_sessions 
        LIMIT 5
      `);
      
      console.log('\nSample data:');
      sample.forEach(s => {
        console.log(`  ${s.vehicleNo}: Charge=${s.chargeAmount}, Paid=${s.creditPaid}, Outstanding=${s.outstanding}, Method=${s.settlementMethod || 'NULL'}, Date=${s.settlementDate || 'NULL'}, Status=${s.paymentStatus}`);
      });
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkColumns();
