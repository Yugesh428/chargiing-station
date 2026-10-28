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

    // Vehicle performance summary
    const vehiclePerformance = await sequelize.query(`
      SELECT 
        "vehicleNo",
        COUNT(*)::int as "totalSessions",
        COALESCE(SUM("chargeAmount"), 0) as "totalRevenue",
        COALESCE(SUM("creditPaid"), 0) as "totalCollected",
        COALESCE(SUM("outstanding"), 0) as "totalOutstanding",
        COALESCE(SUM("usedKwh"), 0) as "totalKwh",
        COALESCE(AVG("chargeAmount"), 0) as "avgRevenue",
        MIN(date) as "firstVisit",
        MAX(date) as "lastVisit",
        COUNT(CASE WHEN "isUdaro"=true THEN 1 END)::int as "udaroSessions",
        COALESCE(SUM(CASE WHEN "isUdaro"=true THEN "outstanding" ELSE 0 END), 0) as "udaroOutstanding"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "vehicleNo"
      ORDER BY "totalRevenue" DESC
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Top revenue vehicles
    const topVehicles = await sequelize.query(`
      SELECT 
        "vehicleNo",
        COUNT(*)::int as sessions,
        COALESCE(SUM("chargeAmount"), 0) as revenue,
        COALESCE(SUM("creditPaid"), 0) as collected
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "vehicleNo"
      ORDER BY revenue DESC
      LIMIT 20
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Visit frequency analysis
    const visitFrequency = await sequelize.query(`
      SELECT 
        CASE 
          WHEN session_count = 1 THEN 'One-time'
          WHEN session_count BETWEEN 2 AND 5 THEN 'Occasional (2-5)'
          WHEN session_count BETWEEN 6 AND 15 THEN 'Regular (6-15)'
          ELSE 'Frequent (15+)'
        END as frequency,
        COUNT(*)::int as "vehicleCount",
        COALESCE(SUM(total_revenue), 0) as "totalRevenue"
      FROM (
        SELECT "vehicleNo", COUNT(*) as session_count, SUM("chargeAmount") as total_revenue
        FROM charging_sessions
        WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
        GROUP BY "vehicleNo"
      ) as vehicle_stats
      GROUP BY 
        CASE 
          WHEN session_count = 1 THEN 'One-time'
          WHEN session_count BETWEEN 2 AND 5 THEN 'Occasional (2-5)'
          WHEN session_count BETWEEN 6 AND 15 THEN 'Regular (6-15)'
          ELSE 'Frequent (15+)'
        END
      ORDER BY 
        CASE 
          WHEN CASE 
            WHEN session_count = 1 THEN 'One-time'
            WHEN session_count BETWEEN 2 AND 5 THEN 'Occasional (2-5)'
            WHEN session_count BETWEEN 6 AND 15 THEN 'Regular (6-15)'
            ELSE 'Frequent (15+)'
          END = 'One-time' THEN 1
          WHEN CASE 
            WHEN session_count = 1 THEN 'One-time'
            WHEN session_count BETWEEN 2 AND 5 THEN 'Occasional (2-5)'
            WHEN session_count BETWEEN 6 AND 15 THEN 'Regular (6-15)'
            ELSE 'Frequent (15+)'
          END = 'Occasional (2-5)' THEN 2
          WHEN CASE 
            WHEN session_count = 1 THEN 'One-time'
            WHEN session_count BETWEEN 2 AND 5 THEN 'Occasional (2-5)'
            WHEN session_count BETWEEN 6 AND 15 THEN 'Regular (6-15)'
            ELSE 'Frequent (15+)'
          END = 'Regular (6-15)' THEN 3
          ELSE 4
        END
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Summary statistics
    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT "vehicleNo")::int as "uniqueVehicles",
        COUNT(*)::int as "totalSessions",
        COALESCE(SUM("chargeAmount"), 0) as "totalRevenue",
        COALESCE(AVG("chargeAmount"), 0) as "avgSessionRevenue"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT }) as any[];

    res.status(200).json({ summary, vehiclePerformance, topVehicles, visitFrequency });
  } catch (err: any) {
    console.error('Vehicle report error:', err);
    res.status(500).json({ message: err.message });
  }
}
