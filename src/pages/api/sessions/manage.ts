import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { normalizeOutstanding } from '../../../utils/paymentCalculations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access sessions' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { status = 'ongoing', period = 'today' } = req.query;
    const { ChargingSession } = await import('../../../models');

    // Build where clause
    const whereClause: any = { tenantId, sessionStatus: status };

    // Add date filter for completed sessions based on period
    if (status === 'completed' && period) {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          // Start of week (Monday)
          const dayOfWeek = now.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      whereClause.date = {
        [Op.gte]: startDate.toISOString().split('T')[0]
      };
    }

    const sessions = await ChargingSession.findAll({
      where: whereClause,
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });

    // Normalize outstanding: recalculate for sessions where it's 0/null but not Paid
    const normalizedSessions = sessions.map(s => {
      const plain = s.get({ plain: true });
      const chargeAmount = parseFloat(String(plain.chargeAmount)) || 0;
      const creditPaid = parseFloat(String(plain.creditPaid)) || 0;
      const storedOutstanding = parseFloat(String(plain.outstanding));
      
      // Use shared utility for consistency
      plain.outstanding = normalizeOutstanding(
        chargeAmount,
        creditPaid,
        storedOutstanding,
        plain.paymentStatus
      );
      
      return plain;
    });

    return res.status(200).json({ sessions: normalizedSessions });
  } catch (err: any) {
    console.error('Manage sessions API error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
