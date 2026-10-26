import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot access expenses - only tenant admin and operators
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { Expense } = await import('../../../models');

    if (req.method === 'GET') {
      const { startDate, endDate } = req.query;
      const where: any = { tenantId };
      if (startDate && endDate) where.date = { [Op.between]: [startDate, endDate] };
      const expenses = await Expense.findAll({ where, order: [['date', 'DESC']] });
      const total = expenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
      return res.status(200).json({ expenses, total: total.toFixed(2) });
    }

    if (req.method === 'POST') {
      const { date, expenseType, description, paymentMethod, amount, paidTo, voucherRef, remarks } = req.body;
      if (!date || !expenseType || !description || !paymentMethod || !amount)
        return res.status(400).json({ message: 'Missing required fields' });
      const expense = await Expense.create({ tenantId, date, expenseType, description, paymentMethod, amount: Number(amount), paidTo, voucherRef, remarks });
      return res.status(201).json({ message: 'Expense added', expense });
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
