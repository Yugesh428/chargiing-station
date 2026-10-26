import type { NextApiResponse } from 'next';
import { Tenant, User } from '../../../models';
import { AuthRequest, authenticate, authorize } from '../../../middleware/auth';
import bcrypt from 'bcryptjs';

export default async function handler(
  req: AuthRequest,
  res: NextApiResponse
) {
  await new Promise<void>((resolve) => {
    authenticate(req, res, resolve);
  });

  if (req.method === 'GET') {
    await new Promise<void>((resolve) => {
      authorize('super_admin')(req, res, resolve);
    });

    try {
      const tenants = await Tenant.findAll({
        include: [
          {
            model: User,
            as: 'users',
            attributes: ['id', 'username', 'email', 'role', 'fullName', 'isActive'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      res.status(200).json({ tenants });
    } catch (error) {
      console.error('Error fetching tenants:', error);
      res.status(500).json({ message: 'Error fetching tenants' });
    }
  } else if (req.method === 'POST') {
    await new Promise<void>((resolve) => {
      authorize('super_admin')(req, res, resolve);
    });

    try {
      const {
        name,
        stationName,
        email,
        phone,
        address,
        adminUsername,
        adminEmail,
        adminPassword,
        adminFullName,
      } = req.body;

      // Validate required fields
      if (!name || !stationName || !email || !adminUsername || !adminEmail || !adminPassword || !adminFullName) {
        return res.status(400).json({ message: 'All required fields must be provided' });
      }

      // Check if tenant email exists
      const existingTenant = await Tenant.findOne({ where: { email } });
      if (existingTenant) {
        return res.status(400).json({ message: 'Tenant with this email already exists' });
      }

      // Check if admin username or email exists
      const existingUser = await User.findOne({
        where: {
          $or: [{ username: adminUsername }, { email: adminEmail }],
        } as any,
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Admin username or email already exists' });
      }

      // Create tenant
      const tenant = await Tenant.create({
        name,
        stationName,
        email,
        phone,
        address,
        isActive: true,
        subscriptionStatus: 'trial',
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        electricityRate: 17.00,
        monthlyStaffCost: 25000.00,
        monthlyRent: 15000.00,
        otherFixedCost: 1300.00,
        defaultPaymentStatus: 'Paid',
        neaCostRate: 9.35,
      });

      // Create tenant admin user
      const admin = await User.create({
        tenantId: tenant.id,
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        role: 'tenant_admin',
        fullName: adminFullName,
        isActive: true,
      });

      res.status(201).json({
        message: 'Tenant created successfully',
        tenant: {
          id: tenant.id,
          name: tenant.name,
          stationName: tenant.stationName,
          email: tenant.email,
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            fullName: admin.fullName,
          },
        },
      });
    } catch (error) {
      console.error('Error creating tenant:', error);
      res.status(500).json({ message: 'Error creating tenant' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
