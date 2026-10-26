import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

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

    const { status = 'ongoing' } = req.query;
    const { ChargingSession } = await import('../../../models');

    const sessions = await ChargingSession.findAll({
      where: { tenantId, sessionStatus: status },
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.status(200).json({ sessions });
  } catch (err: any) {
    console.error('Manage sessions API error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
