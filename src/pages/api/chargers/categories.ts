/**
 * Charger Categories API
 * GET    /api/chargers/categories         - list all categories
 * POST   /api/chargers/categories         - create a new category
 * PUT    /api/chargers/categories?id=...  - update a category
 * DELETE /api/chargers/categories?id=...  - delete (or deactivate) a category
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { ChargerCategory } from '../../../models';

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
      const categories = await ChargerCategory.findAll({
        where: { tenantId },
        order: [['name', 'ASC']],
      });
      return res.status(200).json({ categories });
    }

    // ── POST ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, displayName, description, powerOutput, connectorType, voltage } = req.body;

      if (!name?.trim())        return res.status(400).json({ message: 'name is required' });
      if (!displayName?.trim()) return res.status(400).json({ message: 'displayName is required' });

      // Duplicate check
      const existing = await ChargerCategory.findOne({
        where: { tenantId, name: name.trim().toUpperCase() },
      });
      if (existing) return res.status(409).json({ message: `Category "${name}" already exists` });

      const category = await ChargerCategory.create({
        tenantId,
        name:          name.trim().toUpperCase(),
        displayName:   displayName.trim(),
        description:   description?.trim() || null,
        powerOutput:   powerOutput  != null ? Number(powerOutput)  : undefined,
        connectorType: connectorType?.trim() || null,
        voltage:       voltage      != null ? Number(voltage)      : undefined,
        isActive:      true,
      });

      return res.status(201).json({ message: 'Category created', category });
    }

    // ── PUT ──────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'id is required' });

      const category = await ChargerCategory.findOne({ where: { id, tenantId } });
      if (!category) return res.status(404).json({ message: 'Category not found' });

      const { name, displayName, description, powerOutput, connectorType, voltage, isActive } = req.body;

      // If renaming, check duplicate
      if (name && name.trim().toUpperCase() !== category.name) {
        const dup = await ChargerCategory.findOne({
          where: { tenantId, name: name.trim().toUpperCase() },
        });
        if (dup) return res.status(409).json({ message: `Category "${name}" already exists` });
      }

      await category.update({
        name:          name         ? name.trim().toUpperCase()        : category.name,
        displayName:   displayName  ? displayName.trim()               : category.displayName,
        description:   description  !== undefined ? description?.trim() || null : category.description,
        powerOutput:   powerOutput  != null ? Number(powerOutput)      : category.powerOutput,
        connectorType: connectorType !== undefined ? connectorType?.trim() || null : category.connectorType,
        voltage:       voltage      != null ? Number(voltage)          : category.voltage,
        isActive:      isActive     !== undefined ? Boolean(isActive)  : category.isActive,
      });

      return res.status(200).json({ message: 'Category updated', category });
    }

    // ── DELETE ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'id is required' });

      const category = await ChargerCategory.findOne({ where: { id, tenantId } });
      if (!category) return res.status(404).json({ message: 'Category not found' });

      // Soft-delete: mark inactive (preserves FK integrity with chargers)
      await category.update({ isActive: false });

      return res.status(200).json({ message: 'Category deactivated' });
    }

    return res.status(405).json({ message: 'Method not allowed' });

  } catch (err: any) {
    console.error('Charger categories API error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
}
