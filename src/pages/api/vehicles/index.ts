import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../../config/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    // Handle GET request
    if (req.method === 'GET') {
      const { Vehicle } = await import('../../../models');
      const { QueryTypes } = await import('sequelize');

      // Get session statistics for all vehicles
      const sessionStats = await sequelize.query(`
        SELECT
          "vehicleNo",
          MAX("companyBrand") FILTER (WHERE "companyBrand" IS NOT NULL AND "companyBrand" != '') as "companyBrand",
          MIN(date) as "firstVisit",
          MAX(date) as "lastVisit",
          COUNT(*)::int as "totalVisits",
          COALESCE(SUM("chargedPercent"), 0) as "totalCharged",
          COALESCE(SUM("chargeAmount"), 0) as "totalRevenue",
          ROUND(COALESCE(AVG("ratePerPercent"), 0)::numeric, 2) as "avgRate",
          MAX("ratePerPercent") as "lastRate",
          COALESCE(SUM("outstanding"), 0) as "totalOutstanding",
          COALESCE(SUM("netContribution"), 0) as "netContribution"
        FROM charging_sessions
        WHERE "tenantId" = :tenantId
        GROUP BY "vehicleNo"
        ORDER BY MAX(date) DESC
      `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

      // Get all registered vehicle metadata
      const registeredVehicles = await Vehicle.findAll({
        where: { tenantId },
        raw: true,
        order: [['createdAt', 'DESC']],
      }) as any[];

      // Create a map of session stats by vehicleNo
      const sessionMap = new Map<string, any>();
      sessionStats.forEach((s: any) => sessionMap.set(s.vehicleNo, s));

      // Create a map of registered vehicles by vehicleNo
      const registeredMap = new Map<string, any>();
      registeredVehicles.forEach((v: any) => registeredMap.set(v.vehicleNo, v));

      // FROM SESSIONS: all vehicles seen in sessions, enriched with metadata if available
      const fromSessions = sessionStats.map((stat: any) => {
        const meta = registeredMap.get(stat.vehicleNo) || {};
        return {
          ...stat,
          companyBrand: meta.companyBrand || stat.companyBrand || null,
          ownerName: meta.ownerName || null,
          ownerContact: meta.ownerContact || null,
          notes: meta.notes || null,
          settlementFrequency: meta.settlementFrequency || null,
          isRegistered: registeredMap.has(stat.vehicleNo),
        };
      });

      // OWNER REGISTERED: vehicles in vehicles table, with session stats merged if available
      const ownerRegistered = registeredVehicles.map((v: any) => {
        const stats = sessionMap.get(v.vehicleNo);
        return {
          vehicleNo: v.vehicleNo,
          companyBrand: v.companyBrand || stats?.companyBrand || null,
          ownerName: v.ownerName || null,
          ownerContact: v.ownerContact || null,
          notes: v.notes || null,
          settlementFrequency: v.settlementFrequency || 'monthly',
          firstVisit: stats?.firstVisit || null,
          lastVisit: stats?.lastVisit || null,
          totalVisits: stats?.totalVisits || 0,
          totalCharged: stats?.totalCharged || 0,
          totalRevenue: stats?.totalRevenue || 0,
          avgRate: stats?.avgRate || 0,
          lastRate: stats?.lastRate || null,
          totalOutstanding: stats?.totalOutstanding || 0,
          netContribution: stats?.netContribution || 0,
          hasSessions: !!stats,
          registeredAt: v.createdAt,
        };
      });

      // Also keep the merged vehicles list for backward compat
      const vehicles = fromSessions;

      return res.status(200).json({
        vehicles,           // all session-based vehicles (backward compat)
        fromSessions,       // vehicles discovered from sessions
        ownerRegistered,    // vehicles manually registered by owner
        total: vehicles.length,
      });
    }

    // Handle POST request (Create new vehicle)
    if (req.method === 'POST') {
      const { Vehicle } = await import('../../../models');
      const { vehicleNo, companyBrand, ownerName, ownerContact, notes, settlementFrequency } = req.body;

      if (!vehicleNo || !vehicleNo.trim()) {
        return res.status(400).json({ message: 'Vehicle number is required' });
      }

      const existing = await Vehicle.findOne({ where: { tenantId, vehicleNo: vehicleNo.trim() } });
      if (existing) {
        return res.status(400).json({ message: 'Vehicle with this number already exists' });
      }

      const vehicle = await Vehicle.create({
        tenantId,
        vehicleNo: vehicleNo.trim(),
        companyBrand: companyBrand?.trim() || null,
        ownerName: ownerName?.trim() || null,
        ownerContact: ownerContact?.trim() || null,
        notes: notes?.trim() || null,
        settlementFrequency: settlementFrequency || 'monthly',
      });

      const plain = vehicle.get({ plain: true });

      return res.status(201).json({
        message: 'Vehicle created successfully',
        vehicle: {
          id: plain.id,
          vehicleNo: plain.vehicleNo,
          companyBrand: plain.companyBrand,
          ownerName: plain.ownerName,
          ownerContact: plain.ownerContact,
          notes: plain.notes,
          settlementFrequency: plain.settlementFrequency,
        }
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    console.error('Vehicle API error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}
