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
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(200).json({ stats: null });

    const { Expense } = await import('../../../models');

    const [stats] = await sequelize.query(`
      SELECT
        COUNT(*)::int as "totalSessions",
        COUNT(DISTINCT "vehicleNo")::int as "uniqueVehicles",
        SUM("chargedPercent") as "totalCharged",
        SUM("chargeAmount") as "totalRevenue",
        SUM("electricityCost") as "electricityCost",
        SUM("netContribution") as "netContribution",
        SUM("outstanding") as "pendingAmount"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId
    `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

    // Repeat visits = vehicles with more than 1 session
    const [rv] = await sequelize.query(`
      SELECT COUNT(*)::int as "repeatVisits" FROM (
        SELECT "vehicleNo" FROM charging_sessions WHERE "tenantId" = :tenantId
        GROUP BY "vehicleNo" HAVING COUNT(*) > 1
      ) t
    `, { replacements: { tenantId }, type: QueryTypes.SELECT }) as any[];

    // Expenses
    const expenseTotal = await Expense.sum('amount', { where: { tenantId } });

    // By rate
    const byRate = await sequelize.query(`
      SELECT "ratePerPercent", COUNT(*)::int as sessions, SUM("chargeAmount") as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId
      GROUP BY "ratePerPercent" ORDER BY "ratePerPercent"
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // By charger
    const byCharger = await sequelize.query(`
      SELECT "chargerType", COUNT(*)::int as sessions, SUM("chargeAmount") as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId
      GROUP BY "chargerType"
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // By payment method
    const byPayment = await sequelize.query(`
      SELECT "paymentMethod", SUM("chargeAmount") as total, SUM("outstanding") as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId
      GROUP BY "paymentMethod"
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Daily revenue trend (last 7 days)
    const dailyTrend = await sequelize.query(`
      SELECT 
        date, 
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue,
        SUM("electricityCost") as cost,
        SUM("netContribution") as profit
      FROM charging_sessions 
      WHERE "tenantId" = :tenantId 
        AND date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY date 
      ORDER BY date
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Hourly distribution (all time)
    const hourlyDistribution = await sequelize.query(`
      SELECT 
        EXTRACT(HOUR FROM time::time)::int as hour,
        COUNT(*)::int as sessions,
        SUM("chargeAmount") as revenue
      FROM charging_sessions 
      WHERE "tenantId" = :tenantId AND time IS NOT NULL
      GROUP BY hour
      ORDER BY hour
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // Recent sessions (last 10)
    const recentSessions = await sequelize.query(`
      SELECT 
        id,
        date,
        time,
        "vehicleNo",
        "chargedPercent",
        "chargeAmount",
        "chargerType",
        "paymentMethod",
        "paymentStatus",
        operator,
        "createdAt"
      FROM charging_sessions 
      WHERE "tenantId" = :tenantId
      ORDER BY date DESC, "createdAt" DESC
      LIMIT 10
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    const otherExpenses = expenseTotal || 0;
    const netProfit = parseFloat(stats?.netContribution || 0) - otherExpenses;

    res.status(200).json({
      stats: {
        totalSessions: stats?.totalSessions || 0,
        uniqueVehicles: stats?.uniqueVehicles || 0,
        repeatVisits: rv?.repeatVisits || 0,
        totalCharged: parseFloat(stats?.totalCharged || 0).toFixed(2),
        totalRevenue: parseFloat(stats?.totalRevenue || 0).toFixed(2),
        electricityCost: parseFloat(stats?.electricityCost || 0).toFixed(2),
        netContribution: parseFloat(stats?.netContribution || 0).toFixed(2),
        otherExpenses: otherExpenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        pendingAmount: parseFloat(stats?.pendingAmount || 0).toFixed(2),
      },
      byRate, 
      byCharger, 
      byPayment,
      dailyTrend,
      hourlyDistribution,
      recentSessions,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
}
