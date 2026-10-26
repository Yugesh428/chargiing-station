import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../../config/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot access vehicles - only tenant admin and operators
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { ChargingSession } = await import('../../../models');
    const { QueryTypes } = await import('sequelize');

    const vehicles = await sequelize.query(`
      SELECT
        "vehicleNo",
        MAX("companyBrand") FILTER (WHERE "companyBrand" IS NOT NULL AND "companyBrand" != '') as "companyBrand",
        MIN(date) as "firstVisit",
        MAX(date) as "lastVisit",
        COUNT(*)::int as "totalVisits",
        SUM("chargedPercent") as "totalCharged",
        SUM("chargeAmount") as "totalRevenue",
        ROUND(AVG("ratePerPercent")::numeric, 2) as "avgRate",
        MAX("ratePerPercent") as "lastRate",
        SUM("outstanding") as "totalOutstanding",
        SUM("netContribution") as "netContribution"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId
      GROUP BY "vehicleNo"
      ORDER BY MAX(date) DESC
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    res.status(200).json({ vehicles, total: vehicles.length });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
