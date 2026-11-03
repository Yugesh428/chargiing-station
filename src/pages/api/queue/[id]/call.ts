/**
 * Call Vehicle API
 * 
 * PATCH /api/queue/[id]/call - Call a waiting vehicle
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { callVehicle } from '../../../../services/queueService';

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
        message: 'Super admin cannot perform operational actions.',
      });
    }

    const tenantId = decoded.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant access required' });
    }

    const staffId = decoded.id;
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid queue entry ID' });
    }

    // PATCH - Call vehicle
    if (req.method === 'PATCH') {
      try {
        const updatedEntry = await callVehicle(id, tenantId, staffId);

        return res.status(200).json({
          success: true,
          message: 'Vehicle called successfully',
          data: updatedEntry,
        });
      } catch (error: any) {
        if (error.message === 'Queue entry not found') {
          return res.status(404).json({
            success: false,
            message: 'Queue entry not found',
          });
        }

        if (error.message.includes('Cannot call vehicle')) {
          return res.status(400).json({
            success: false,
            message: error.message,
            code: 'INVALID_STATUS_TRANSITION',
          });
        }

        throw error;
      }
    }

    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  } catch (error: any) {
    console.error('Call vehicle API error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
