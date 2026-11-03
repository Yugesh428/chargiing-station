/**
 * Queue History API
 * 
 * GET /api/queue/history - Get historical queue entries with filters
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { getQueueHistory } from '../../../services/queueService';
import { QueueStatus } from '../../../models/VehicleQueue';

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

    // GET - Retrieve queue history
    if (req.method === 'GET') {
      const {
        status,
        vehicleId,
        startDate,
        endDate,
        page = '1',
        limit = '50',
      } = req.query;

      // Parse status filter (can be comma-separated)
      let statusFilter: QueueStatus[] | undefined;
      if (status && typeof status === 'string') {
        statusFilter = status.split(',').filter((s) => s.trim()) as QueueStatus[];
      }

      const result = await getQueueHistory(tenantId, {
        status: statusFilter,
        vehicleId: vehicleId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    }

    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  } catch (error: any) {
    console.error('Queue history API error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
