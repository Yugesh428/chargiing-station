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

async function checkUsers() {
  try {
    await sequelize.authenticate();
    
    const [results] = await sequelize.query(`
      SELECT 
        u.email, 
        u."fullName", 
        u.role, 
        t."stationName", 
        t.id as "tenantId",
        u."tenantId" as "userTenantId"
      FROM users u 
      LEFT JOIN tenants t ON u."tenantId" = t.id 
      WHERE u.email IN ('lekali_admin@lekali-ev.com', 'zylo_admin@zylo-ev.com')
      ORDER BY u.email
    `);
    
    console.log('\n👥 USER & TENANT INFORMATION');
    console.log('='.repeat(60));
    console.log(JSON.stringify(results, null, 2));
    console.log('='.repeat(60));
    
    if (results.length > 0) {
      const tenantIds = [...new Set(results.map(r => r.tenantId))];
      console.log('\n📊 Summary:');
      console.log(`  Total users found: ${results.length}`);
      console.log(`  Unique tenants: ${tenantIds.length}`);
      
      if (tenantIds.length === 1) {
        console.log('\n⚠️  BOTH USERS BELONG TO THE SAME TENANT!');
        console.log('  This is why they see the same data.');
        console.log('  Run "npm run create:zylo" to create a separate tenant.');
      } else {
        console.log('\n✅ Users belong to different tenants (correct setup)');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
