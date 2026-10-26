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
      SELECT COUNT(*)::int as sessions, COUNT(DISTINCT "vehicleNo")::int as vehicles,
        SUM("chargeAmount") as revenue, SUM("electricityCost") as electricityCost,
        SUM("netContribution") as netContribution, SUM("outstanding") as outstanding,
        SUM(CASE WHEN "paymentMethod"='Cash' THEN "chargeAmount" - "outstanding" ELSE 0 END) as cashCollected,
        SUM(CASE WHEN "paymentMethod"='Bank/QR' THEN "chargeAmount" - "outstanding" ELSE 0 END) as qrCollected,
        SUM(CASE WHEN "paymentMethod"='Credit' THEN "chargeAmount" ELSE 0 END) as creditSales
      FROM charging_sessions
      WHERE "tenantId" = :tenantId AND date = :date
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT }) as any[];

    const byRate = await sequelize.query(`
      SELECT "ratePerPercent", COUNT(*)::int as sessions, SUM("chargeAmount") as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "ratePerPercent" ORDER BY "ratePerPercent"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const byCharger = await sequelize.query(`
      SELECT "chargerType", COUNT(*)::int as sessions, SUM("chargeAmount") as revenue
      FROM charging_sessions WHERE "tenantId" = :tenantId AND date = :date
      GROUP BY "chargerType"
    `, { replacements: { tenantId, date }, type: QueryTypes.SELECT });

    const expenses = await Expense.findAll({ where: { tenantId, date: String(date) } });
    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);

    res.status(200).json({ summary, byRate, byCharger, expenses, totalExpenses });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
