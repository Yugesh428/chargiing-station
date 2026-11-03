/**
 * Assign Vehicle to Charger API
 * 
 * POST /api/queue/[id]/assign - Assign vehicle to charger and create charging session
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { assignToCharger } from '../../../../services/queueService';

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

    // POST - Assign to charger
    if (req.method === 'POST') {
      const {
        chargerId,
        chargerType,
        arrivalSoc,
        ratePerPercent,
        paymentMethod,
        paymentStatus,
      } = req.body;

      // Validation
      if (!chargerId || !chargerId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'chargerId is required (e.g., GBT-1, CCS2-2)',
        });
      }

      if (!chargerType || !['GBT', 'CCS2'].includes(chargerType)) {
        return res.status(400).json({
          success: false,
          message: 'chargerType must be either GBT or CCS2',
        });
      }

      // Validate SOC if provided
      if (arrivalSoc != null) {
        const soc = Number(arrivalSoc);
        if (isNaN(soc) || soc < 0 || soc > 100) {
          return res.status(400).json({
            success: false,
            message: 'arrivalSoc must be between 0 and 100',
          });
        }
      }

      try {
        const result = await assignToCharger({
          queueId: id,
          chargerId: chargerId.trim(),
          chargerType,
          tenantId,
          staffId,
          arrivalSoc: arrivalSoc != null ? Number(arrivalSoc) : undefined,
          ratePerPercent: ratePerPercent != null ? Number(ratePerPercent) : undefined,
          paymentMethod: paymentMethod || 'Cash',
          paymentStatus: paymentStatus || 'Pending',
        });

        return res.status(200).json({
          success: true,
          message: 'Vehicle assigned to charger successfully',
          data: result,
        });
      } catch (error: any) {
        // Handle specific business logic errors
        if (error.message === 'Queue entry not found') {
          return res.status(404).json({
            success: false,
            message: 'Queue entry not found',
          });
        }

        if (error.message.includes('Cannot assign vehicle')) {
          return res.status(400).json({
            success: false,
            message: error.message,
            code: 'INVALID_STATUS_TRANSITION',
          });
        }

        if (error.message === 'Vehicle is already charging') {
          return res.status(409).json({
            success: false,
            message: 'Vehicle is already charging',
            code: 'VEHICLE_ALREADY_CHARGING',
          });
        }

        if (error.message.includes('Charger') && error.message.includes('occupied')) {
          return res.status(409).json({
            success: false,
            message: error.message,
            code: 'CHARGER_OCCUPIED',
          });
        }

        if (error.message === 'Vehicle data not found') {
          return res.status(404).json({
            success: false,
            message: 'Vehicle data not found',
          });
        }

        if (error.message === 'Tenant not found') {
          return res.status(404).json({
            success: false,
            message: 'Tenant configuration not found',
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
    console.error('Assign charger API error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}
