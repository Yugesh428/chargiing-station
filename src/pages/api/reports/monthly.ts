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
      SELECT COUNT(*)::int as sessions, SUM("chargeAmount") as revenue,
        SUM("electricityCost") as electricityCost, SUM("netContribution") as netContribution,
        SUM("outstanding") as outstanding
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT }) as any[];

    const byRate = await sequelize.query(`
      SELECT "ratePerPercent", COUNT(*)::int as sessions, SUM("chargeAmount") as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "ratePerPercent" ORDER BY "ratePerPercent"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byCharger = await sequelize.query(`
      SELECT "chargerType", COUNT(*)::int as sessions, SUM("chargeAmount") as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "chargerType"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const byPayment = await sequelize.query(`
      SELECT "paymentMethod", SUM("chargeAmount") as revenue, SUM("outstanding") as outstanding
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "paymentMethod"
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    const varExpenses = await Expense.sum('amount', { where: { tenantId, date: { [Op.between]: [startDate, endDate] } } }) || 0;
    const tenant = await Tenant.findByPk(tenantId);

    const staffCost = parseFloat(String(tenant?.monthlyStaffCost || 25000));
    const rent = parseFloat(String(tenant?.monthlyRent || 15000));
    const fixedOther = parseFloat(String(tenant?.otherFixedCost || 1300));
    const revenue = parseFloat(summary?.revenue || 0);
    const electricityCost = parseFloat(summary?.electricityCost || 0);
    const totalCost = electricityCost + varExpenses + staffCost + rent + fixedOther;
    const netProfit = revenue - totalCost;

    res.status(200).json({ summary, byRate, byCharger, byPayment, varExpenses, staffCost, rent, fixedOther, totalCost, netProfit });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
