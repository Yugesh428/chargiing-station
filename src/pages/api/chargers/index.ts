/**
 * Chargers API
 * GET    /api/chargers         - list all chargers (with category info)
 * POST   /api/chargers         - create a new charger
 * PUT    /api/chargers?id=...  - update a charger
 * DELETE /api/chargers?id=...  - deactivate a charger
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Charger, ChargerCategory } from '../../../models';

function getTenant(req: NextApiRequest, res: NextApiResponse): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return null; }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.role === 'super_admin') {
      res.status(403).json({ message: 'Super admin cannot access operational data.' });
      return null;
    }
    if (!decoded.tenantId) { res.status(400).json({ message: 'Tenant access required' }); return null; }
    return decoded.tenantId as string;
  } catch {
    res.status(401).json({ message: 'Invalid token' });
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tenantId = getTenant(req, res);
    if (!tenantId) return;

    // ── GET ──────────────────────────────────────────────────
    if (req.method === 'GET') {
      const chargers = await Charger.findAll({
        where: { tenantId },
        include: [
          {
            model: ChargerCategory,
            as: 'category',
            attributes: ['id', 'name', 'displayName', 'connectorType', 'powerOutput'],
          },
        ],
        order: [['chargerId', 'ASC']],
      });
      return res.status(200).json({ chargers });
    }

    // ── POST ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const {
        categoryId, chargerId, displayName, location,
        status, serialNumber, manufacturer, model,
        installationDate, notes,
      } = req.body;

      if (!categoryId)         return res.status(400).json({ message: 'categoryId is required' });
      if (!chargerId?.trim())  return res.status(400).json({ message: 'chargerId is required' });
      if (!displayName?.trim()) return res.status(400).json({ message: 'displayName is required' });

      // Validate category belongs to this tenant
      const category = await ChargerCategory.findOne({ where: { id: categoryId, tenantId } });
      if (!category) return res.status(404).json({ message: 'Charger category not found' });

      // Duplicate chargerId check
      const existing = await Charger.findOne({ where: { tenantId, chargerId: chargerId.trim() } });
      if (existing) return res.status(409).json({ message: `Charger ID "${chargerId}" already exists` });

      const charger = await Charger.create({
        tenantId,
        categoryId,
        chargerId:      chargerId.trim(),
        displayName:    displayName.trim(),
        location:       location?.trim()       || null,
        status:         status                 || 'AVAILABLE',
        serialNumber:   serialNumber?.trim()   || null,
        manufacturer:   manufacturer?.trim()   || null,
        model:          model?.trim()          || null,
        installationDate: installationDate     || null,
        notes:          notes?.trim()          || null,
        isActive:       true,
      });

      const withCategory = await Charger.findByPk(charger.id, {
        include: [{ model: ChargerCategory, as: 'category', attributes: ['id', 'name', 'displayName', 'connectorType', 'powerOutput'] }],
      });

      return res.status(201).json({ message: 'Charger created', charger: withCategory });
    }

    // ── PUT ──────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'id is required' });

      const charger = await Charger.findOne({ where: { id, tenantId } });
      if (!charger) return res.status(404).json({ message: 'Charger not found' });

      const {
        categoryId, chargerId, displayName, location,
        status, serialNumber, manufacturer, model,
        installationDate, lastMaintenanceDate, nextMaintenanceDate,
        notes, isActive,
      } = req.body;

      // Validate new categoryId if provided
      if (categoryId && categoryId !== charger.categoryId) {
        const cat = await ChargerCategory.findOne({ where: { id: categoryId, tenantId } });
        if (!cat) return res.status(404).json({ message: 'Charger category not found' });
      }

      // Duplicate chargerId check on rename
      if (chargerId && chargerId.trim() !== charger.chargerId) {
        const dup = await Charger.findOne({ where: { tenantId, chargerId: chargerId.trim() } });
        if (dup) return res.status(409).json({ message: `Charger ID "${chargerId}" already exists` });
      }

      await charger.update({
        categoryId:          categoryId           || charger.categoryId,
        chargerId:           chargerId?.trim()    || charger.chargerId,
        displayName:         displayName?.trim()  || charger.displayName,
        location:            location             !== undefined ? location?.trim() || null   : charger.location,
        status:              status               || charger.status,
        serialNumber:        serialNumber         !== undefined ? serialNumber?.trim() || null : charger.serialNumber,
        manufacturer:        manufacturer         !== undefined ? manufacturer?.trim() || null : charger.manufacturer,
        model:               model                !== undefined ? model?.trim() || null        : charger.model,
        installationDate:    installationDate     !== undefined ? installationDate || null      : charger.installationDate,
        lastMaintenanceDate: lastMaintenanceDate  !== undefined ? lastMaintenanceDate || null   : charger.lastMaintenanceDate,
        nextMaintenanceDate: nextMaintenanceDate  !== undefined ? nextMaintenanceDate || null   : charger.nextMaintenanceDate,
        notes:               notes                !== undefined ? notes?.trim() || null         : charger.notes,
        isActive:            isActive             !== undefined ? Boolean(isActive)             : charger.isActive,
      });

      const updated = await Charger.findByPk(charger.id, {
        include: [{ model: ChargerCategory, as: 'category', attributes: ['id', 'name', 'displayName', 'connectorType', 'powerOutput'] }],
      });

      return res.status(200).json({ message: 'Charger updated', charger: updated });
    }

    // ── DELETE ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'id is required' });

      const charger = await Charger.findOne({ where: { id, tenantId } });
      if (!charger) return res.status(404).json({ message: 'Charger not found' });

      await charger.update({ isActive: false });
      return res.status(200).json({ message: 'Charger deactivated' });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    console.error('Chargers API error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}
