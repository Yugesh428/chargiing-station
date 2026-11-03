/**
 * Next Vehicle API
 * 
 * GET /api/queue/next - Get the next eligible vehicle in queue
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getNextVehicle } from '../../../services/queueService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (decoded.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin cannot access operational data.',
      });
    }

    const tenantId = decoded.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant access required' });
    }

    // GET - Get next vehicle
    if (req.method === 'GET') {
      const nextVehicle = await getNextVehicle(tenantId);

      if (!nextVehicle) {
        return res.status(200).json({
          success: true,
          message: 'No vehicles waiting in queue',
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        data: nextVehicle,
      });
    }

    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  } catch (error: any) {
    console.error('Next vehicle API error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
