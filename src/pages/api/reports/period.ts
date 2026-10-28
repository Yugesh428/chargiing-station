import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../../config/database';
import { QueryTypes } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot access reports
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access reports. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });
    
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate required' });

    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*)::int as "totalSessions", 
        COUNT(DISTINCT "vehicleNo")::int as "uniqueVehicles",
        COALESCE(SUM("chargeAmount"), 0) as "totalRevenue", 
        COALESCE(SUM("electricityCost"), 0) as "totalElectricityCost",
        COALESCE(SUM("netContribution"), 0) as "totalNetContribution", 
        COALESCE(SUM("outstanding"), 0) as "totalOutstanding",
        COALESCE(SUM("creditPaid"), 0) as "totalCollected",
        COUNT(CASE WHEN "sessionStatus"='ongoing' THEN 1 END)::int as "ongoingSessions",
        COUNT(CASE WHEN "sessionStatus"='pending_payment' THEN 1 END)::int as "pendingPaymentSessions",
        COUNT(CASE WHEN "sessionStatus"='completed' THEN 1 END)::int as "completedSessions",
        COUNT(CASE WHEN "isUdaro"=true THEN 1 END)::int as "udaroSessions",
        COALESCE(SUM(CASE WHEN "isUdaro"=true THEN "outstanding" ELSE 0 END), 0) as "udaroOutstanding",
        COALESCE(SUM(CASE WHEN "isUdaro"=false OR "isUdaro" IS NULL THEN "outstanding" ELSE 0 END), 0) as "regularOutstanding",
        COALESCE(SUM(CASE WHEN "isUdaro"=true THEN "chargeAmount" ELSE 0 END), 0) as "udaroRevenue",
        COALESCE(SUM(CASE WHEN "isUdaro"=true THEN "creditPaid" ELSE 0 END), 0) as "udaroCollected"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT }) as any[];

    const byRate = await sequelize.query(`
      SELECT "ratePerPercent", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("creditPaid"), 0) as collected, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "ratePerPercent" ORDER BY "ratePerPercent"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byCharger = await sequelize.query(`
      SELECT "chargerType", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("creditPaid"), 0) as collected, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "chargerType"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byMethod = await sequelize.query(`
      SELECT "paymentMethod", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("creditPaid"), 0) as collected, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "paymentMethod"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byStatus = await sequelize.query(`
      SELECT "sessionStatus", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "sessionStatus"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byPaymentStatus = await sequelize.query(`
      SELECT "paymentStatus", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "paymentStatus"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    res.status(200).json({ summary, byRate, byCharger, byMethod, byStatus, byPaymentStatus });
  } catch (err: any) {
    console.error('Period report error:', err);
    res.status(500).json({ message: err.message });
  }
}
