import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tenantId = decoded.role === 'super_admin' ? req.query.tenantId as string : decoded.tenantId;

    const { Expense } = await import('../../../models');
    const expense = await Expense.findOne({ where: { id: req.query.id, tenantId } });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (req.method === 'DELETE') {
      await expense.destroy();
      return res.status(200).json({ message: 'Deleted' });
    }
    res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
