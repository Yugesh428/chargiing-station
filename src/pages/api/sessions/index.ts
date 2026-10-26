import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot create sessions - only tenant admin and operators can
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot manage sessions. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant admin access required' });

    const { ChargingSession } = await import('../../../models');

    if (req.method === 'GET') {
      const { startDate, endDate, vehicleNo, chargerType, paymentMethod, paymentStatus, page = '1', limit = '50' } = req.query;
      const where: any = { tenantId };
      if (startDate && endDate) where.date = { [Op.between]: [startDate, endDate] };
      else if (startDate) where.date = { [Op.gte]: startDate };
      if (vehicleNo) where.vehicleNo = { [Op.iLike]: `%${vehicleNo}%` };
      if (chargerType) where.chargerType = chargerType;
      if (paymentMethod) where.paymentMethod = paymentMethod;
      if (paymentStatus) where.paymentStatus = paymentStatus;

      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await ChargingSession.findAndCountAll({
        where, limit: Number(limit), offset,
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
      });

      return res.status(200).json({ sessions: rows, total: count, page: Number(page), totalPages: Math.ceil(count / Number(limit)) });
    }

    if (req.method === 'POST') {
      const { date, time, vehicleNo, arrivalSoc, departureSoc, ratePerPercent, chargeAmount, chargerType, paymentMethod, paymentStatus, companyBrand, operator, remarks } = req.body;

      // Get user data from token for operator name
      const userData = decoded.fullName || decoded.username || 'Unknown';
      const operatorName = operator || userData;

      // Validations - only required fields: date, vehicleNo, chargerType
      if (!date || !vehicleNo || !chargerType)
        return res.status(400).json({ message: 'Missing required fields: date, vehicleNo, chargerType' });
      
      // Use defaults for optional fields
      const finalPaymentMethod = paymentMethod || 'Cash';
      const finalPaymentStatus = paymentStatus || 'Pending';
      
      // Only validate SOC if both are provided
      if (arrivalSoc != null && departureSoc != null) {
        if (Number(departureSoc) <= Number(arrivalSoc))
          return res.status(400).json({ message: 'Departure SOC must be greater than arrival SOC' });
        if (Number(departureSoc) < 0 || Number(departureSoc) > 100)
          return res.status(400).json({ message: 'Departure SOC must be between 0 and 100' });
      }
      
      if (arrivalSoc != null && (Number(arrivalSoc) < 0 || Number(arrivalSoc) > 100))
        return res.status(400).json({ message: 'Arrival SOC must be between 0 and 100' });

      // Duplicate guard - only check if we have complete data
      if (arrivalSoc != null && departureSoc != null) {
        const duplicate = await ChargingSession.findOne({
          where: { tenantId, vehicleNo, date, departureSoc: Number(departureSoc) },
        });
        if (duplicate) return res.status(409).json({ message: 'Duplicate: same vehicle, date and departure SOC already exists', duplicate: true });
      }

      // Fetch tenant settings for dynamic calculation
      const { Tenant } = await import('../../../models');
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      
      const electricityRate = parseFloat(String(tenant.electricityRate)) || 17;
      const neaCostRate = parseFloat(String(tenant.neaCostRate)) || 9.35;

      // Calculations - priority: manual chargeAmount > auto-calculated
      let chargedPercent = null;
      let finalChargeAmount = 0;
      let usedKwh = 0;
      let electricityCost = 0;
      let netContribution = 0;
      
      if (chargeAmount != null && chargeAmount !== '') {
        // Manual charge amount provided - use it directly
        finalChargeAmount = Number(chargeAmount);
        usedKwh = finalChargeAmount / electricityRate;
        electricityCost = usedKwh * neaCostRate;
        netContribution = finalChargeAmount - electricityCost;
        
        // Calculate chargedPercent if we have SOC data
        if (arrivalSoc != null && departureSoc != null) {
          chargedPercent = Number(departureSoc) - Number(arrivalSoc);
        }
      } else if (arrivalSoc != null && departureSoc != null && ratePerPercent != null) {
        // Auto-calculate from SOC and rate
        chargedPercent = Number(departureSoc) - Number(arrivalSoc);
        finalChargeAmount = chargedPercent * Number(ratePerPercent);
        usedKwh = finalChargeAmount / electricityRate;
        electricityCost = usedKwh * neaCostRate;
        netContribution = finalChargeAmount - electricityCost;
      }
      
      // UDARO (Credit) Logic:
      // - If payment status is "Paid" → customer already paid, no udaro
      // - If payment status is "Pending" → customer hasn't paid yet, full udaro
      // - If payment status is "Partially Paid" → customer paid some, remaining is udaro
      
      let outstanding = 0;
      let creditPaid = 0;
      
      if (finalPaymentStatus === 'Paid') {
        // Already paid - no udaro (outstanding)
        outstanding = 0;
        creditPaid = finalChargeAmount;
      } else if (finalPaymentStatus === 'Pending') {
        // Not yet paid - full amount is udaro
        outstanding = finalChargeAmount;
        creditPaid = 0;
      } else if (finalPaymentStatus === 'Partially Paid') {
        // Partially paid - some udaro remains
        outstanding = finalChargeAmount; // Will be updated when payment is recorded
        creditPaid = 0;
      }

      // Visit number
      const visitCount = await ChargingSession.count({ where: { tenantId, vehicleNo } });
      const visitNo = visitCount + 1;

      const session = await ChargingSession.create({
        tenantId, 
        date,
        time: time || new Date().toTimeString().slice(0, 5),
        vehicleNo: String(vehicleNo).trim(),
        arrivalSoc: arrivalSoc != null ? Number(arrivalSoc) : null,
        departureSoc: departureSoc != null ? Number(departureSoc) : null,
        chargedPercent, 
        ratePerPercent: ratePerPercent != null ? Number(ratePerPercent) : null,
        chargeAmount: finalChargeAmount, 
        visitNo, 
        chargerType, 
        paymentMethod: finalPaymentMethod, 
        paymentStatus: finalPaymentStatus,
        sessionStatus: (departureSoc != null || finalChargeAmount > 0) ? 'pending_payment' : 'ongoing', // ongoing if no departure and no charge
        operator: operatorName, 
        remarks: remarks || null,
        usedKwh: usedKwh > 0 ? parseFloat(usedKwh.toFixed(3)) : 0,
        electricityRate,
        electricityCost: parseFloat(electricityCost.toFixed(2)),
        netContribution: parseFloat(netContribution.toFixed(2)),
        creditPaid, 
        outstanding: parseFloat(outstanding.toFixed(2)),
        companyBrand: companyBrand || null,
      });

      return res.status(201).json({ message: 'Session created', session });
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    console.error('Sessions API error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
}
