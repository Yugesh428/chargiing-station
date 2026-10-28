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
    
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access reports. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });
    
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate required' });

    // Settlement vehicle summary (Udaro arrangements)
    const settlementVehicles = await sequelize.query(`
      SELECT 
        "vehicleNo",
        COUNT(*)::int as "udaroSessions",
        COALESCE(SUM("chargeAmount"), 0) as "totalUdaroRevenue",
        COALESCE(SUM("creditPaid"), 0) as "totalCollected",
        COALESCE(SUM("outstanding"), 0) as "totalOutstanding",
        COUNT(CASE WHEN "paymentStatus"='Paid' THEN 1 END)::int as "settledSessions",
        COUNT(CASE WHEN "paymentStatus"!='Paid' THEN 1 END)::int as "pendingSessions",
        MIN("udaroDueDate") as "earliestDueDate",
        MAX("udaroDueDate") as "latestDueDate"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId 
        AND date BETWEEN :startDate AND :endDate
        AND "isUdaro" = true
      GROUP BY "vehicleNo"
      ORDER BY "totalOutstanding" DESC
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Settlement payment status
    const paymentStatus = await sequelize.query(`
      SELECT 
        "paymentStatus",
        COUNT(*)::int as sessions,
        COALESCE(SUM("chargeAmount"), 0) as revenue,
        COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions
      WHERE "tenantId" = :tenantId 
        AND date BETWEEN :startDate AND :endDate
        AND "isUdaro" = true
      GROUP BY "paymentStatus"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Overdue analysis
    const overdueAnalysis = await sequelize.query(`
      SELECT 
        CASE 
          WHEN "udaroDueDate" >= CURRENT_DATE THEN 'Not Due Yet'
          WHEN "udaroDueDate" < CURRENT_DATE AND "outstanding" > 0 THEN 'Overdue'
          ELSE 'Settled'
        END as status,
        COUNT(*)::int as sessions,
        COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions
      WHERE "tenantId" = :tenantId 
        AND date BETWEEN :startDate AND :endDate
        AND "isUdaro" = true
      GROUP BY status
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Collection efficiency
    const collectionEfficiency = await sequelize.query(`
      SELECT 
        "vehicleNo",
        COUNT(*)::int as sessions,
        COALESCE(SUM("chargeAmount"), 0) as revenue,
        COALESCE(SUM("creditPaid"), 0) as collected,
        COALESCE(SUM("outstanding"), 0) as outstanding,
        CASE 
          WHEN SUM("chargeAmount") > 0 
          THEN ROUND((SUM("creditPaid") / SUM("chargeAmount") * 100)::numeric, 2)
          ELSE 0 
        END as "collectionRate"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId 
        AND date BETWEEN :startDate AND :endDate
        AND "isUdaro" = true
      GROUP BY "vehicleNo"
      ORDER BY "collectionRate" ASC, outstanding DESC
      LIMIT 20
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Summary statistics
    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*)::int as "totalUdaroSessions",
        COUNT(DISTINCT "vehicleNo")::int as "settlementVehicles",
        COALESCE(SUM("chargeAmount"), 0) as "totalRevenue",
        COALESCE(SUM("creditPaid"), 0) as "totalCollected",
        COALESCE(SUM("outstanding"), 0) as "totalOutstanding",
        COUNT(CASE WHEN "udaroDueDate" < CURRENT_DATE AND "outstanding" > 0 THEN 1 END)::int as "overdueSessions",
        COALESCE(SUM(CASE WHEN "udaroDueDate" < CURRENT_DATE AND "outstanding" > 0 THEN "outstanding" ELSE 0 END), 0) as "overdueAmount"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId 
        AND date BETWEEN :startDate AND :endDate
        AND "isUdaro" = true
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT }) as any[];

    res.status(200).json({ 
      summary, 
      settlementVehicles, 
      paymentStatus, 
      overdueAnalysis,
      collectionEfficiency
    });
  } catch (err: any) {
    console.error('Settlement report error:', err);
    res.status(500).json({ message: err.message });
  }
}
