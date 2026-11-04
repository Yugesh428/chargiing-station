/**
 * GET /api/vehicles/find?vehicleNo=xxx
 * Returns the Vehicle record id for a given vehicleNo (creates it if not exists)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.role === 'super_admin') return res.status(403).json({ message: 'Forbidden' });
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant access required' });

    const vehicleNoRaw = req.query.vehicleNo;
    const vehicleNo = Array.isArray(vehicleNoRaw) ? vehicleNoRaw[0] : vehicleNoRaw;

    if (!vehicleNo || !vehicleNo.trim()) {
      return res.status(400).json({ message: 'vehicleNo query param is required' });
    }

    const { Vehicle } = await import('../../../models');
    const trimmed = vehicleNo.trim().toUpperCase();

    console.log('[find] tenantId:', tenantId, '| vehicleNo:', trimmed);

    // Find existing — use raw SQL to bypass any model mapping issues
    const sequelize = (await import('../../../config/database')).default;
    const [rows] = await sequelize.query(
      `SELECT id, "vehicleNo", "companyBrand", "ownerName", "ownerContact" 
       FROM vehicles 
       WHERE "tenantId" = :tenantId AND "vehicleNo" = :vehicleNo 
       LIMIT 1`,
      { replacements: { tenantId, vehicleNo: trimmed } }
    );

    if ((rows as any[]).length > 0) {
      const v = (rows as any[])[0];
      console.log('[find] Found existing vehicle:', v.id);
      return res.status(200).json({
        id:           v.id,
        vehicleNo:    v.vehicleNo,
        companyBrand: v.companyBrand,
        ownerName:    v.ownerName,
        ownerContact: v.ownerContact,
      });
    }

    // Not found — create via Sequelize model
    const vehicle = await Vehicle.create({
      tenantId,
      vehicleNo: trimmed,
    });

    const plain = vehicle.get({ plain: true });
    console.log('[find] Created new vehicle:', plain.id);
    return res.status(200).json({
      id:           plain.id,
      vehicleNo:    plain.vehicleNo,
      companyBrand: plain.companyBrand,
      ownerName:    plain.ownerName,
      ownerContact: plain.ownerContact,
    });
  } catch (err: any) {
    console.error('Vehicle find error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}
