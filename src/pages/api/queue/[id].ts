/**
 * Queue Entry Details API
 * 
 * GET /api/queue/[id] - Get specific queue entry details
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { VehicleQueue, Vehicle, ChargingSession, User } from '../../../models';

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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid queue entry ID' });
    }

    // GET - Retrieve queue entry details
    if (req.method === 'GET') {
      const queueEntry = await VehicleQueue.findOne({
        where: { id, tenantId },
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
          },
          {
            model: ChargingSession,
            as: 'chargingSession',
            required: false,
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'fullName', 'username', 'email'],
            required: false,
          },
          {
            model: User,
            as: 'caller',
            attributes: ['id', 'fullName', 'username'],
            required: false,
          },
          {
            model: User,
            as: 'assigner',
            attributes: ['id', 'fullName', 'username'],
            required: false,
          },
          {
            model: User,
            as: 'canceller',
            attributes: ['id', 'fullName', 'username'],
            required: false,
          },
        ],
      });

      if (!queueEntry) {
        return res.status(404).json({
          success: false,
          message: 'Queue entry not found',
        });
      }

      // Calculate waiting time
      const plain = queueEntry.get({ plain: true });
      const now = new Date();
      const joinedAt = new Date(plain.joinedAt);
      const waitingMinutes = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60));

      // Calculate total processing time if completed
      let totalProcessingMinutes = null;
      if (plain.assignedAt) {
        const assignedAt = new Date(plain.assignedAt);
        totalProcessingMinutes = Math.floor(
          (assignedAt.getTime() - joinedAt.getTime()) / (1000 * 60)
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          ...plain,
          waitingMinutes,
          totalProcessingMinutes,
        },
      });
    }

    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  } catch (error: any) {
    console.error('Queue entry details API error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
