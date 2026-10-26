import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot access settings - only tenant admin
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { Tenant } = await import('../../../models');
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    if (req.method === 'GET') return res.status(200).json({ settings: tenant });

    if (req.method === 'PUT') {
      const { stationName, electricityRate, neaCostRate, monthlyStaffCost, monthlyRent, otherFixedCost, defaultPaymentStatus, rateMaster } = req.body;
      await tenant.update({ 
        stationName, 
        electricityRate, 
        neaCostRate, 
        monthlyStaffCost, 
        monthlyRent, 
        otherFixedCost, 
        defaultPaymentStatus,
        rateMaster 
      });
      return res.status(200).json({ message: 'Settings updated', settings: tenant });
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
