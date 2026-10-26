import type { NextApiResponse } from 'next';
import { Tenant, User } from '../../../models';
import { AuthRequest, authenticate, authorize } from '../../../middleware/auth';

export default async function handler(
  req: AuthRequest,
  res: NextApiResponse
) {
  await new Promise<void>((resolve) => {
    authenticate(req, res, resolve);
  });

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const tenant = await Tenant.findByPk(Number(id), {
        include: [
          {
            model: User,
            as: 'users',
            attributes: ['id', 'username', 'email', 'role', 'fullName', 'isActive'],
          },
        ],
      });

      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // Check authorization
      if (req.user!.role !== 'super_admin' && req.user!.tenantId !== tenant.id) {
        return res.status(403).json({ message: 'Unauthorized access' });
      }

      res.status(200).json({ tenant });
    } catch (error) {
      console.error('Error fetching tenant:', error);
      res.status(500).json({ message: 'Error fetching tenant' });
    }
  } else if (req.method === 'PUT') {
    await new Promise<void>((resolve) => {
      authorize('super_admin', 'tenant_admin')(req, res, resolve);
    });

    try {
      const tenant = await Tenant.findByPk(Number(id));

      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // Check authorization
      if (req.user!.role !== 'super_admin' && req.user!.tenantId !== tenant.id) {
        return res.status(403).json({ message: 'Unauthorized access' });
      }

      const updateData = req.body;

      // Only super_admin can change these fields
      if (req.user!.role !== 'super_admin') {
        delete updateData.isActive;
        delete updateData.subscriptionStatus;
        delete updateData.subscriptionExpiry;
      }

      await tenant.update(updateData);

      res.status(200).json({
        message: 'Tenant updated successfully',
        tenant,
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      res.status(500).json({ message: 'Error updating tenant' });
    }
  } else if (req.method === 'DELETE') {
    await new Promise<void>((resolve) => {
      authorize('super_admin')(req, res, resolve);
    });

    try {
      const tenant = await Tenant.findByPk(Number(id));

      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // Soft delete - just deactivate
      await tenant.update({ isActive: false });

      res.status(200).json({ message: 'Tenant deactivated successfully' });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      res.status(500).json({ message: 'Error deleting tenant' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
