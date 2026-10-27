import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../../config/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tenantId = decoded.role === 'super_admin' ? req.query.tenantId as string : decoded.tenantId;
    
    const { vehicleNo } = req.query;
    
    if (!vehicleNo || typeof vehicleNo !== 'string') {
      return res.status(400).json({ message: 'Vehicle number is required' });
    }

    // Handle GET request - Fetch vehicle history
    if (req.method === 'GET') {
      const { ChargingSession, Vehicle } = await import('../../../models');

      // Fetch vehicle metadata
      const vehicleMetadata = await Vehicle.findOne({
        where: { tenantId, vehicleNo: String(vehicleNo) },
        raw: true,
      });

      // Fetch all sessions for this vehicle, ordered by date DESC (most recent first)
      const sessions = await ChargingSession.findAll({
        where: { tenantId, vehicleNo: String(vehicleNo) },
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        raw: true,
      });

      // If no vehicle metadata AND no sessions, return 404
      if (!vehicleMetadata && sessions.length === 0) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Calculate summary statistics with proper null handling
      const totalVisits = sessions.length;
      
      let totalRevenue = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;
      let totalKwh = 0;
      
      for (const session of sessions) {
        const chargeAmount = Number(session.chargeAmount) || 0;
        totalRevenue += chargeAmount;
        
        const creditPaid = Number(session.creditPaid) || 0;
        totalPaid += creditPaid;
        
        const outstanding = Number(session.outstanding) || 0;
        totalOutstanding += outstanding;
        
        const usedKwh = Number(session.usedKwh) || 0;
        totalKwh += usedKwh;
      }
      
      const avgChargeAmount = totalVisits > 0 ? totalRevenue / totalVisits : 0;

      // Get first and last visit dates
      const firstVisit = sessions.length > 0 ? sessions[sessions.length - 1].date : null;
      const lastVisit = sessions.length > 0 ? sessions[0].date : null;

      // Prefer metadata brand, fallback to session brand
      const companyBrand = vehicleMetadata?.companyBrand || 
                          sessions.find(s => s.companyBrand)?.companyBrand || 
                          null;

      return res.status(200).json({
        totalVisits,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
        totalKwh: Number(totalKwh.toFixed(2)),
        avgChargeAmount: Number(avgChargeAmount.toFixed(2)),
        firstVisit,
        lastVisit,
        companyBrand,
        ownerName: vehicleMetadata?.ownerName || null,
        ownerContact: vehicleMetadata?.ownerContact || null,
        notes: vehicleMetadata?.notes || null,
        sessions: sessions.map(s => ({
          id: s.id,
          date: s.date,
          time: s.time || null,
          chargeAmount: Number(s.chargeAmount) || 0,
          creditPaid: Number(s.creditPaid) || 0,
          outstanding: Number(s.outstanding) || 0,
          paymentStatus: s.paymentStatus || 'Pending',
          settlementMethod: s.settlementMethod || null,
          settlementDate: s.settlementDate || null,
          chargerType: s.chargerType || null,
          usedKwh: Number(s.usedKwh) || 0,
          remarks: s.remarks || null,
        })),
      });
    }

    // Handle PUT request - Update vehicle metadata
    if (req.method === 'PUT') {
      const { Vehicle } = await import('../../../models');
      const { companyBrand, ownerName, ownerContact, notes, settlementFrequency } = req.body;

      const [vehicle, created] = await Vehicle.findOrCreate({
        where: { tenantId, vehicleNo: String(vehicleNo) },
        defaults: {
          tenantId,
          vehicleNo: String(vehicleNo),
          companyBrand: companyBrand?.trim() || null,
          ownerName: ownerName?.trim() || null,
          ownerContact: ownerContact?.trim() || null,
          notes: notes?.trim() || null,
          settlementFrequency: settlementFrequency || 'monthly',
        },
      });

      if (!created) {
        await vehicle.update({
          companyBrand: companyBrand?.trim() || null,
          ownerName: ownerName?.trim() || null,
          ownerContact: ownerContact?.trim() || null,
          notes: notes?.trim() || null,
          settlementFrequency: settlementFrequency || 'monthly',
        });
      }

      const plain = vehicle.get({ plain: true });

      return res.status(200).json({
        message: 'Vehicle updated successfully',
        vehicle: {
          id: plain.id,
          vehicleNo: plain.vehicleNo,
          companyBrand: plain.companyBrand,
          ownerName: plain.ownerName,
          ownerContact: plain.ownerContact,
          notes: plain.notes,
          settlementFrequency: plain.settlementFrequency,
        },
      });
    }

    // Handle DELETE request - Delete vehicle and all sessions
    if (req.method === 'DELETE') {
      const { Vehicle, ChargingSession } = await import('../../../models');

      // Use transaction to ensure atomicity
      const transaction = await sequelize.transaction();

      try {
        // Delete all sessions for this vehicle
        const deletedSessions = await ChargingSession.destroy({
          where: { tenantId, vehicleNo: String(vehicleNo) },
          transaction,
        });

        // Delete vehicle metadata record
        const deletedVehicle = await Vehicle.destroy({
          where: { tenantId, vehicleNo: String(vehicleNo) },
          transaction,
        });

        await transaction.commit();

        return res.status(200).json({
          message: 'Vehicle and all sessions deleted successfully',
          deletedSessions,
          deletedVehicle: deletedVehicle > 0,
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    console.error('Vehicle API error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}
