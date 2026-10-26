import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tenantId = decoded.role === 'super_admin' ? req.query.tenantId as string : decoded.tenantId;

    const { ChargingSession } = await import('../../../models');
    const { vehicleNo } = req.query;

    const sessions = await ChargingSession.findAll({
      where: { tenantId, vehicleNo: String(vehicleNo) },
      order: [['date', 'ASC'], ['createdAt', 'ASC']],
    });

    if (sessions.length === 0) return res.status(404).json({ message: 'Vehicle not found' });

    const totalRevenue = sessions.reduce((s, x) => s + parseFloat(String(x.chargeAmount)), 0);
    const totalCharged = sessions.reduce((s, x) => s + parseFloat(String(x.chargedPercent)), 0);
    const totalOutstanding = sessions.reduce((s, x) => s + parseFloat(String(x.outstanding || 0)), 0);
    const totalNetContribution = sessions.reduce((s, x) => s + parseFloat(String(x.netContribution)), 0);
    const lastSession = sessions[sessions.length - 1];
    const brand = sessions.filter(s => s.companyBrand).map(s => s.companyBrand).pop() || null;

    res.status(200).json({
      vehicle: {
        vehicleNo,
        companyBrand: brand,
        firstVisit: sessions[0].date,
        lastVisit: lastSession.date,
        totalVisits: sessions.length,
        totalCharged: totalCharged.toFixed(2),
        totalRevenue: totalRevenue.toFixed(2),
        totalOutstanding: totalOutstanding.toFixed(2),
        netContribution: totalNetContribution.toFixed(2),
        lastRate: lastSession.ratePerPercent,
      },
      sessions,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
