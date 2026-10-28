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
    
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access reports. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });
    
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate required' });

    const { Expense } = await import('../../../models');

    // Expenses by type
    const byType = await sequelize.query(`
      SELECT 
        "expenseType",
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(AVG(amount), 0) as average,
        MIN(amount) as minimum,
        MAX(amount) as maximum
      FROM expenses
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "expenseType"
      ORDER BY total DESC
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Expenses by payment method
    const byPaymentMethod = await sequelize.query(`
      SELECT 
        "paymentMethod",
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY "paymentMethod"
      ORDER BY total DESC
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Monthly trend
    const monthlyTrend = await sequelize.query(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY month
      ORDER BY month ASC
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Top expenses
    const topExpenses = await sequelize.query(`
      SELECT 
        date,
        "expenseType",
        description,
        "paymentMethod",
        amount,
        "paidTo",
        "voucherRef"
      FROM expenses
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      ORDER BY amount DESC
      LIMIT 20
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Daily average
    const dailyStats = await sequelize.query(`
      SELECT 
        date,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT });

    // Summary statistics
    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*)::int as "totalExpenses",
        COALESCE(SUM(amount), 0) as "totalAmount",
        COALESCE(AVG(amount), 0) as "avgExpense",
        MIN(amount) as "minExpense",
        MAX(amount) as "maxExpense",
        COUNT(DISTINCT "expenseType")::int as "expenseTypes"
      FROM expenses
      WHERE "tenantId" = :tenantId AND date BETWEEN :startDate AND :endDate
    `, { replacements: { tenantId, startDate, endDate }, type: QueryTypes.SELECT }) as any[];

    // Calculate date range in days
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dailyAverage = summary.totalAmount / daysDiff;

    res.status(200).json({ 
      summary: { ...summary, dailyAverage, dayCount: daysDiff }, 
      byType, 
      byPaymentMethod,
      monthlyTrend,
      topExpenses,
      dailyStats
    });
  } catch (err: any) {
    console.error('Expense report error:', err);
    res.status(500).json({ message: err.message });
  }
}
