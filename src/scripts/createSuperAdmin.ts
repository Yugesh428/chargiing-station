import { User } from '../models';
import { syncDatabase } from '../models';

const createSuperAdmin = async () => {
  try {
    await syncDatabase();

    const existingSuperAdmin = await User.findOne({
      where: { role: 'super_admin' },
    });

    if (existingSuperAdmin) {
      console.log('Super admin already exists');
      return;
    }

    const superAdmin = await User.create({
      username: 'superadmin',
      email: 'admin@evcharging.com',
      password: 'Admin@123',
      role: 'super_admin',
      fullName: 'Super Administrator',
      isActive: true,
    });

    console.log('Super admin created successfully');
    console.log('Username: superadmin');
    console.log('Password: Admin@123');
    console.log('Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();
