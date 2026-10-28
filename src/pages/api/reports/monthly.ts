import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../../config/database';
import { QueryTypes, Op } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tenantId = decoded.role === 'super_admin' ? req.query.tenantId as string : decoded.tenantId;
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ message: 'month required (YYYY-MM)' });

    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().slice(0, 10);

    const { Expense, Tenant } = await import('../../../models');

    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*)::int as sessions, 
        COALESCE(SUM("chargeAmount"), 0) as revenue,
        COALESCE(SUM("electricityCost"), 0) as "electricityCost", 
        COALESCE(SUM("netContribution"), 0) as "netContribution",
        COALESCE(SUM("outstanding"), 0) as outstanding,
        COALESCE(SUM("creditPaid"), 0) as "totalCollected",
        COUNT(CASE WHEN "sessionStatus"='ongoing' THEN 1 END)::int as "ongoingSessions",
        COUNT(CASE WHEN "sessionStatus"='pending_payment' THEN 1 END)::int as "pendingPaymentSessions",
        COUNT(CASE WHEN "sessionStatus"='completed' THEN 1 END)::int as "completedSessions",
        COUNT(CASE WHEN "isUdaro"=true THEN 1 END)::int as "udaroSessions",
        COALESCE(SUM(CASE WHEN "isUdaro"=true THEN "outstanding" ELSE 0 END), 0) as "udaroOutstanding",
        COALESCE(SUM(CASE WHEN "isUdaro"=false OR "isUdaro" IS NULL THEN "outstanding" ELSE 0 END), 0) as "regularOutstanding"
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

    const byPayment = await sequelize.query(`
      SELECT "paymentMethod", COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("creditPaid"), 0) as collected, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "paymentMethod"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byStatus = await sequelize.query(`
      SELECT "sessionStatus", COUNT(*)::int as sessions, COALESCE(SUM("chargeAmount"), 0) as revenue, COALESCE(SUM("outstanding"), 0) as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "sessionStatus"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const varExpenses = await Expense.sum('amount', { where: { tenantId, date: { [Op.between]: [startDate, endDate] } } }) || 0;
    
    const expensesByType = await sequelize.query(`
      SELECT "expenseType", COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "expenseType"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const tenant = await Tenant.findByPk(tenantId);

    const staffCost = parseFloat(String(tenant?.monthlyStaffCost || 25000));
    const rent = parseFloat(String(tenant?.monthlyRent || 15000));
    const fixedOther = parseFloat(String(tenant?.otherFixedCost || 1300));
    const revenue = parseFloat(summary?.revenue || 0);
    const electricityCost = parseFloat(summary?.electricityCost || 0);
    const totalCost = electricityCost + varExpenses + staffCost + rent + fixedOther;
    const netProfit = revenue - totalCost;

    const pnl = {
      revenue,
      electricityCost,
      variableExpenses: varExpenses,
      staffCost,
      rent,
      otherFixed: fixedOther,
      totalCost,
      netProfit
    };

    const paymentBreakdown = {
      cash: 0,
      bankQr: 0,
      credit: 0
    };

    // Calculate payment breakdown from byPayment data
    (byPayment as any[]).forEach((item: any) => {
      const amt = parseFloat(item.revenue || 0);
      if (item.paymentMethod === 'Cash') paymentBreakdown.cash = amt;
      else if (item.paymentMethod === 'Bank/QR') paymentBreakdown.bankQr = amt;
      else if (item.paymentMethod === 'Credit') paymentBreakdown.credit = amt;
    });

    res.status(200).json({ 
      summary, 
      byRate, 
      byCharger, 
      byPayment, 
      byStatus,
      expensesByType,
      pnl,
      paymentBreakdown,
      month
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
