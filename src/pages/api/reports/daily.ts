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
    const tenantId = decoded.role === 'super_admin' ? req.query.tenantId as string : decoded.tenantId;
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date required' });

    const { Expense } = await import('../../../models');

    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*)::int as sessions, 
        COUNT(DISTINCT "vehicleNo")::int as "uniqueVehicles",
        COALESCE(SUM("chargeAmount"), 0) as revenue,
        COALESCE(SUM("electricityCost"), 0) as "electricityCost",
        COALESCE(SUM("netContribution"), 0) as "netContribution",
        COALESCE(SUM("outstanding"), 0) as outstanding,
        COALESCE(SUM("creditPaid"), 0) as "totalCollected",
        COALESCE(SUM(CASE WHEN "paymentMethod"='Cash' THEN "creditPaid" ELSE 0 END), 0) as "cashCollected",
        COALESCE(SUM(CASE WHEN "paymentMethod"='Bank/QR' THEN "creditPaid" ELSE 0 END), 0) as "bankCollected",
        COALESCE(SUM(CASE WHEN "paymentMethod"='Credit' THEN "chargeAmount" ELSE 0 END), 0) as "creditSales",
        COALESCE(SUM(CASE WHEN "paymentMethod"='Credit' THEN "creditPaid" ELSE 0 END), 0) as "creditCollected",
        COUNT(CASE WHEN "sessionStatus"='ongoing' THEN 1 END)::int as "ongoingSessions",
        COUNT(CASE WHEN "sessionStatus"='pending_payment' THEN 1 END)::int as "pendingPaymentSessions",
        COUNT(CASE WHEN "sessionStatus"='completed' THEN 1 END)::int as "completedSessions",
        COUNT(CASE WHEN "isUdaro"=true THEN 1 END)::int as "udaroSessions",
        COALESCE(SUM(CASE WHEN "isUdaro"=true THEN "outstanding" ELSE 0 END), 0) as "udaroOutstanding",
        COALESCE(SUM(CASE WHEN "isUdaro"=false OR "isUdaro" IS NULL THEN "outstanding" ELSE 0 END), 0) as "regularOutstanding"
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date = :date
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT }) as any[];

    const byRate = await sequelize.query(`
      SELECT "ratePerPercent", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "ratePerPercent" ORDER BY "ratePerPercent"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const byCharger = await sequelize.query(`
      SELECT "chargerType", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "chargerType"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const byStatus = await sequelize.query(`
      SELECT "sessionStatus", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "sessionStatus"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const byPaymentMethod = await sequelize.query(`
      SELECT "paymentMethod", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("creditPaid"), 0) as collected, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "paymentMethod"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const expenses = await Expense.findAll({ where: { tenantId, date: String(date) } });
    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
    
    const expensesByType = await sequelize.query(`
      SELECT "expenseType", COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "expenseType"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const netProfit = parseFloat(summary.revenue || 0) - parseFloat(summary.electricityCost || 0) - totalExpenses;

    res.status(200).json({ 
      summary: { ...summary, totalExpenses, netProfit }, 
      byRate, 
      byCharger, 
      byStatus,
      byPaymentMethod,
      expenses,
      expensesByType
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
