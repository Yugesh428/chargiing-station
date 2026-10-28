import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.role === 'super_admin') return res.status(403).json({ message: 'Super admin cannot manage vehicles' });

    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { Vehicle } = await import('../../../models');

    // ─── DELETE: Remove from settlement arrangement ────────────────────────────
    if (req.method === 'DELETE') {
      const { vehicleNo } = req.query;
      if (!vehicleNo) return res.status(400).json({ message: 'vehicleNo is required' });

      const vehicle = await Vehicle.findOne({ where: { tenantId, vehicleNo: String(vehicleNo) } });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

      await vehicle.update({
        isSettlementVehicle: false,
        settlementFrequency: null,
        settlementDayOfWeek: null,
        settlementDayOfMonth: null,
        customSettlementDays: null,
        nextDueDate: null,
      });

      return res.status(200).json({ message: `${vehicleNo} removed from settlement arrangement` });
    }

    // ─── POST: Add or update (upsert) settlement vehicle ──────────────────────
    if (req.method === 'POST') {
      const {
        vehicleNo, ownerName, ownerContact,
        settlementFrequency, settlementDayOfWeek, settlementDayOfMonth,
        customSettlementDays, notes, isSettlementVehicle,
      } = req.body;

      if (!vehicleNo || !ownerName) {
        return res.status(400).json({ message: 'Vehicle number and owner name are required' });
      }
      if (!settlementFrequency || !['weekly', 'monthly', 'custom'].includes(settlementFrequency)) {
        return res.status(400).json({ message: 'Valid settlement frequency required: weekly, monthly, or custom' });
      }

      const nextDue = calculateNextDueDate(settlementFrequency, settlementDayOfWeek, settlementDayOfMonth, customSettlementDays);

      const existing = await Vehicle.findOne({ where: { tenantId, vehicleNo: vehicleNo.trim() } });

      if (existing) {
        await existing.update({
          ownerName: ownerName.trim(),
          ownerContact: ownerContact?.trim() || null,
          isSettlementVehicle: true,
          settlementFrequency,
          settlementDayOfWeek: settlementFrequency === 'weekly' ? settlementDayOfWeek : null,
          settlementDayOfMonth: settlementFrequency === 'monthly' ? settlementDayOfMonth : null,
          customSettlementDays: settlementFrequency === 'custom' ? customSettlementDays : null,
          notes: notes?.trim() || null,
          nextDueDate: nextDue,
        });
        console.log(`[Settlement Vehicle] Updated: ${vehicleNo} → ${settlementFrequency}`);
        return res.status(200).json({ message: 'Vehicle updated with settlement arrangement', vehicle: existing });
      }

      const vehicle = await Vehicle.create({
        tenantId,
        vehicleNo: vehicleNo.trim(),
        ownerName: ownerName.trim(),
        ownerContact: ownerContact?.trim() || null,
        isSettlementVehicle: true,
        settlementFrequency,
        settlementDayOfWeek: settlementFrequency === 'weekly' ? settlementDayOfWeek : null,
        settlementDayOfMonth: settlementFrequency === 'monthly' ? settlementDayOfMonth : null,
        customSettlementDays: settlementFrequency === 'custom' ? customSettlementDays : null,
        notes: notes?.trim() || null,
        nextDueDate: nextDue,
      });

      console.log(`[Settlement Vehicle] Created: ${vehicleNo} → ${settlementFrequency} for ${ownerName}`);
      return res.status(201).json({ message: 'Settlement vehicle registered successfully', vehicle });
    }

    return res.status(405).json({ message: 'Method not allowed' });

  } catch (err: any) {
    console.error('Settlement vehicle API error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}

function calculateNextDueDate(frequency: string, dayOfWeek?: number, dayOfMonth?: number, customDays?: number): Date {
  const now = new Date();

  if (frequency === 'weekly' && dayOfWeek !== undefined) {
    const today = now.getDay();
    const daysUntilNext = (dayOfWeek - today + 7) % 7 || 7;
    const d = new Date(now);
    d.setDate(now.getDate() + daysUntilNext);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (frequency === 'monthly' && dayOfMonth !== undefined) {
    const d = new Date(now);
    d.setDate(dayOfMonth);
    d.setHours(0, 0, 0, 0);
    if (d <= now) d.setMonth(d.getMonth() + 1);
    return d;
  }

  if (frequency === 'custom' && customDays) {
    const d = new Date(now);
    d.setDate(now.getDate() + customDays);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const d = new Date(now);
  d.setDate(now.getDate() + 30);
  d.setHours(0, 0, 0, 0);
  return d;
}
