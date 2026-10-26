import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const tenantId = decoded.role === 'super_admin' ? req.body.tenantId : decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'tenantId required' });

    const { ChargingSession, Tenant } = await import('../../../models');
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows)) return res.status(400).json({ message: 'rows array required' });

    // Fetch tenant settings for dynamic calculation
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
    
    const electricityRate = parseFloat(String(tenant.electricityRate)) || 17;
    const neaCostRate = parseFloat(String(tenant.neaCostRate)) || 9.35;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const {
          date, vehicleNo, arrivalSoc, departureSoc, ratePerPercent,
          chargerType, paymentMethod, paymentStatus, companyBrand,
          operator, remarks, creditPaid = 0, settlementMethod, settlementDate,
        } = row;

        if (!date || !vehicleNo || arrivalSoc == null || departureSoc == null || !ratePerPercent || !chargerType || !paymentMethod || !paymentStatus) {
          skipped++;
          errors.push(`Row skipped: missing required fields for vehicle ${vehicleNo}`);
          continue;
        }

        const dep = Number(departureSoc);
        const arr = Number(arrivalSoc);
        if (dep <= arr || arr < 0 || dep > 100) {
          skipped++;
          errors.push(`Row skipped: invalid SOC for vehicle ${vehicleNo} on ${date}`);
          continue;
        }

        // Check duplicate
        const dup = await ChargingSession.findOne({ where: { tenantId, vehicleNo: String(vehicleNo), date, departureSoc: dep } });
        if (dup) { skipped++; continue; }

        const chargedPercent = dep - arr;
        const chargeAmount = chargedPercent * Number(ratePerPercent);
        const usedKwh = chargeAmount / electricityRate;
        const electricityCost = usedKwh * neaCostRate;
        const netContribution = chargeAmount - electricityCost;
        let outstanding = Number(creditPaid) > 0 ? Math.max(0, chargeAmount - Number(creditPaid)) : (paymentMethod === 'Credit' ? chargeAmount : (paymentStatus === 'Pending' ? chargeAmount : 0));

        const visitCount = await ChargingSession.count({ where: { tenantId, vehicleNo: String(vehicleNo) } });

        await ChargingSession.create({
          tenantId, date, vehicleNo: String(vehicleNo).trim(),
          arrivalSoc: arr, departureSoc: dep,
          chargedPercent, ratePerPercent: Number(ratePerPercent),
          chargeAmount, visitNo: visitCount + 1,
          chargerType: String(chargerType).trim(),
          paymentMethod: String(paymentMethod).trim(),
          paymentStatus: String(paymentStatus).trim(),
          operator, remarks,
          usedKwh: parseFloat(usedKwh.toFixed(3)),
          electricityRate,
          electricityCost: parseFloat(electricityCost.toFixed(2)),
          netContribution: parseFloat(netContribution.toFixed(2)),
          creditPaid: Number(creditPaid),
          outstanding: parseFloat(outstanding.toFixed(2)),
          settlementMethod: settlementMethod || null,
          settlementDate: settlementDate || null,
          companyBrand: companyBrand || null,
        });
        imported++;
      } catch (rowErr: any) {
        skipped++;
        errors.push(`Row error: ${rowErr.message}`);
      }
    }

    res.status(200).json({ imported, skipped, errors: errors.slice(0, 20), message: `Imported ${imported} sessions, skipped ${skipped}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
