import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data.' });
    }

    const { ChargingSession, Vehicle } = await import('../../../models');
    const { QueryTypes } = await import('sequelize');
    const sequelize = (await import('../../../config/database')).default;

    const { vehicleNo } = req.query;
    if (!vehicleNo) return res.status(400).json({ message: 'vehicleNo required' });

    const tenantId = decoded.tenantId;

    // Use raw SQL to avoid Sequelize defaultValue overriding actual DB values
    const [rawVehicles] = await sequelize.query(
      `SELECT *, "isSettlementVehicle"::boolean as "isSettlementVehicle" 
       FROM vehicles WHERE "tenantId" = :tenantId AND "vehicleNo" = :vehicleNo LIMIT 1`,
      { replacements: { tenantId, vehicleNo: String(vehicleNo) }, type: QueryTypes.SELECT }
    ) as any[];
    const vehicleMeta = rawVehicles || null;

    const isSettlementVehicle = vehicleMeta?.isSettlementVehicle === true;

    // Calculate next due date for settlement vehicles
    let nextDueDate: string | null = null;
    if (isSettlementVehicle && vehicleMeta?.nextDueDate) {
      nextDueDate = String(vehicleMeta.nextDueDate).slice(0, 10);
    }

    // Session history
    const sessions = await ChargingSession.findAll({
      where: { tenantId, vehicleNo: String(vehicleNo) },
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });

    if (sessions.length === 0) {
      return res.status(200).json({
        isNew: true,
        visits: 0,
        lastRate: null,
        lastVisit: null,
        companyBrand: vehicleMeta?.companyBrand || null,
        // Settlement info
        isSettlementVehicle,
        settlementFrequency: vehicleMeta?.settlementFrequency || null,
        settlementDayOfWeek: vehicleMeta?.settlementDayOfWeek ?? null,
        settlementDayOfMonth: vehicleMeta?.settlementDayOfMonth ?? null,
        customSettlementDays: vehicleMeta?.customSettlementDays ?? null,
        nextDueDate,
        ownerName: vehicleMeta?.ownerName || null,
        ownerContact: vehicleMeta?.ownerContact || null,
      });
    }

    const latest = sessions[0]; // kept for reference

    // Use plain objects to reliably access field values
    const plains = sessions.map(s => s.get({ plain: true }));

    const totalAmount = plains.reduce((sum, s) => {
      const v = parseFloat(String(s.chargeAmount));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    const totalCharged = plains.reduce((sum, s) => {
      const v = parseFloat(String(s.chargedPercent));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    // Outstanding: use stored value if valid, else recalculate from chargeAmount - creditPaid
    const totalOutstanding = plains.reduce((sum, s) => {
      if (s.paymentStatus === 'Paid') return sum; // skip fully paid sessions
      const charge = parseFloat(String(s.chargeAmount)) || 0;
      const paid = parseFloat(String(s.creditPaid)) || 0;
      const stored = parseFloat(String(s.outstanding));
      const due = (!isNaN(stored) && stored > 0) ? stored : Math.max(0, charge - paid);
      return sum + due;
    }, 0);

    return res.status(200).json({
      isNew: false,
      visits: sessions.length,
      lastRate: plains[0].ratePerPercent,
      lastVisit: plains[0].date,
      lastCharger: plains[0].chargerType,
      companyBrand: vehicleMeta?.companyBrand || plains[0].companyBrand || null,
      totalAmount: totalAmount.toFixed(2),
      totalCharged: totalCharged.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      // Settlement info
      isSettlementVehicle,
      settlementFrequency: vehicleMeta?.settlementFrequency || null,
      settlementDayOfWeek: vehicleMeta?.settlementDayOfWeek ?? null,
      settlementDayOfMonth: vehicleMeta?.settlementDayOfMonth ?? null,
      customSettlementDays: vehicleMeta?.customSettlementDays ?? null,
      nextDueDate,
      ownerName: vehicleMeta?.ownerName || null,
      ownerContact: vehicleMeta?.ownerContact || null,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
