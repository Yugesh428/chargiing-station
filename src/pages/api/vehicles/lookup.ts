import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Super admin cannot access vehicle lookup
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }

    const { ChargingSession } = await import('../../../models');
    const { Op } = await import('sequelize');

    const { vehicleNo } = req.query;
    if (!vehicleNo) return res.status(400).json({ message: 'vehicleNo required' });

    const tenantId = decoded.tenantId;

    const sessions = await ChargingSession.findAll({
      where: { tenantId, vehicleNo: String(vehicleNo) },
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });

    if (sessions.length === 0) {
      return res.status(200).json({ isNew: true, visits: 0, lastRate: null, lastVisit: null, companyBrand: null });
    }

    const latest = sessions[0];
    const totalAmount = sessions.reduce((s, sess) => s + parseFloat(String(sess.chargeAmount)), 0);
    const totalCharged = sessions.reduce((s, sess) => s + parseFloat(String(sess.chargedPercent)), 0);
    const totalOutstanding = sessions.reduce((s, sess) => s + parseFloat(String(sess.outstanding || 0)), 0);

    return res.status(200).json({
      isNew: false,
      visits: sessions.length,
      lastRate: latest.ratePerPercent,
      lastVisit: latest.date,
      lastCharger: latest.chargerType,
      companyBrand: latest.companyBrand || null,
      totalAmount: totalAmount.toFixed(2),
      totalCharged: totalCharged.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
