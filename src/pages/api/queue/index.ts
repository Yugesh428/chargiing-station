/**
 * Queue Management API - Main Endpoint
 * 
 * GET  /api/queue - Get active queue (WAITING, CALLED)
 * POST /api/queue - Add vehicle to queue
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { addToQueue, getActiveQueue } from '../../../services/queueService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Super admin cannot access operational endpoints
    if (decoded.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super admin cannot access operational data. Please login as tenant admin.',
      });
    }

    const tenantId = decoded.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant access required',
      });
    }

    const staffId = decoded.id;

    // GET - Retrieve active queue
    if (req.method === 'GET') {
      const { page = '1', limit = '50' } = req.query;

      const result = await getActiveQueue(
        tenantId,
        parseInt(page as string),
        parseInt(limit as string)
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    }

    // POST - Add vehicle to queue
    if (req.method === 'POST') {
      const { vehicleId, notes, priority } = req.body;

      // Validation
      if (!vehicleId) {
        return res.status(400).json({
          success: false,
          message: 'vehicleId is required',
        });
      }

      try {
        const queueEntry = await addToQueue({
          tenantId,
          vehicleId,
          notes,
          priority: priority != null ? parseInt(priority) : 0,
          staffId,
        });

        return res.status(201).json({
          success: true,
          message: 'Vehicle added to queue successfully',
          data: queueEntry,
        });
      } catch (error: any) {
        // Handle specific business logic errors
        if (error.message === 'Vehicle not found') {
          return res.status(404).json({
            success: false,
            message: 'Vehicle not found',
            code: 'VEHICLE_NOT_FOUND',
          });
        }

        if (error.message === 'Vehicle already in queue') {
          return res.status(409).json({
            success: false,
            message: 'Vehicle is already in the queue',
            code: 'DUPLICATE_QUEUE_ENTRY',
          });
        }

        if (error.message === 'Vehicle is currently charging') {
          return res.status(409).json({
            success: false,
            message: 'Vehicle is currently charging and cannot join the queue',
            code: 'VEHICLE_CHARGING',
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
    console.error('Queue API error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
