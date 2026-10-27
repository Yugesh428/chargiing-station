import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access sessions' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { id } = req.query;
    const { departureSoc } = req.body; // Require departure SOC to complete
    
    const { ChargingSession } = await import('../../../../models');

    const session = await ChargingSession.findOne({ where: { id, tenantId } });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // SESSION STATUS RULE: Based ONLY on Departure SOC
    // To complete a session, departure SOC must be provided
    if (!departureSoc && departureSoc !== 0) {
      return res.status(400).json({ 
        message: 'Departure SOC is required to complete a session',
        hint: 'Session status is determined by Departure SOC. Please provide departureSoc to mark as completed.'
      });
    }

    // Calculate session status based on Departure SOC
    const newSessionStatus = (departureSoc != null && departureSoc !== '') ? 'completed' : 'ongoing';

    // Update session with departure SOC, which will automatically set status to completed
    await session.update({ 
      departureSoc: Number(departureSoc),
      sessionStatus: newSessionStatus
    });

    return res.status(200).json({ 
      message: `Session marked as ${newSessionStatus}`,
      session 
    });
  } catch (err: any) {
    console.error('Complete session API error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}