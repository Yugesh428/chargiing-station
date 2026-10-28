import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import sequelize from '../../../config/database';
import { calculatePaymentDetails } from '../../../utils/paymentCalculations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot access sessions
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;

    const { ChargingSession } = await import('../../../models');
    const { id } = req.query;

    const session = await ChargingSession.findOne({ where: { id, tenantId } });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (req.method === 'GET') return res.status(200).json({ session });

    if (req.method === 'DELETE') {
      await session.destroy();
      return res.status(200).json({ message: 'Session deleted' });
    }

    if (req.method === 'PUT') {
      const { 
        vehicleNo, arrivalSoc, departureSoc, ratePerPercent, chargeAmount,
        chargerType, paymentMethod, paymentStatus, companyBrand, remarks,
        creditPaid, settlementMethod, settlementDate, isUdaro, udaroDueDate 
      } = req.body;
      
      // Get tenant settings for recalculation
      const { Tenant } = await import('../../../models');
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      
      const electricityRate = parseFloat(String(tenant.electricityRate)) || 17;
      const neaCostRate = parseFloat(String(tenant.neaCostRate)) || 9.35;
      
      const updates: any = {};
      
      // Basic fields
      if (vehicleNo) updates.vehicleNo = vehicleNo;
      if (companyBrand !== undefined) updates.companyBrand = companyBrand;
      if (remarks !== undefined) updates.remarks = remarks;
      if (chargerType) updates.chargerType = chargerType;
      if (paymentMethod) updates.paymentMethod = paymentMethod;
      if (paymentStatus) updates.paymentStatus = paymentStatus;
      
      // Settlement (Udaro) fields
      if (isUdaro !== undefined) updates.isUdaro = isUdaro;
      if (udaroDueDate !== undefined) updates.udaroDueDate = udaroDueDate || null;
      
      // Recalculate if SOC, rate, or charge amount changed
      const newArrival = arrivalSoc !== undefined ? (arrivalSoc ? Number(arrivalSoc) : null) : session.arrivalSoc;
      const newDeparture = departureSoc !== undefined ? (departureSoc ? Number(departureSoc) : null) : session.departureSoc;
      const newRate = ratePerPercent !== undefined ? (ratePerPercent ? Number(ratePerPercent) : null) : session.ratePerPercent;
      const newChargeAmount = chargeAmount !== undefined ? (chargeAmount ? Number(chargeAmount) : null) : null;
      
      // Priority: manual charge amount > auto-calculated
      if (newChargeAmount !== null) {
        // Manual charge amount provided
        const finalChargeAmount = newChargeAmount;
        const usedKwh = finalChargeAmount / electricityRate;
        const electricityCost = usedKwh * neaCostRate;
        const netContribution = finalChargeAmount - electricityCost;
        
        updates.chargeAmount = finalChargeAmount;
        updates.usedKwh = parseFloat(usedKwh.toFixed(3));
        updates.electricityRate = electricityRate;
        updates.electricityCost = parseFloat(electricityCost.toFixed(2));
        updates.netContribution = parseFloat(netContribution.toFixed(2));
        
        // Update SOC fields if provided
        if (arrivalSoc !== undefined) updates.arrivalSoc = newArrival;
        if (departureSoc !== undefined) updates.departureSoc = newDeparture;
        if (ratePerPercent !== undefined) updates.ratePerPercent = newRate;
        
        // Calculate chargedPercent if we have both SOC values
        if (newArrival !== null && newDeparture !== null) {
          updates.chargedPercent = newDeparture - newArrival;
        }
      } else if (arrivalSoc !== undefined || departureSoc !== undefined || ratePerPercent !== undefined) {
        // Auto-calculate if SOC or rate changed
        if (newArrival !== null && newDeparture !== null && newRate !== null) {
          const chargedPercent = newDeparture - newArrival;
          const finalChargeAmount = chargedPercent * newRate;
          const usedKwh = finalChargeAmount / electricityRate;
          const electricityCost = usedKwh * neaCostRate;
          const netContribution = finalChargeAmount - electricityCost;
          
          updates.arrivalSoc = newArrival;
          updates.departureSoc = newDeparture;
          updates.ratePerPercent = newRate;
          updates.chargedPercent = chargedPercent;
          updates.chargeAmount = finalChargeAmount;
          updates.usedKwh = parseFloat(usedKwh.toFixed(3));
          updates.electricityRate = electricityRate;
          updates.electricityCost = parseFloat(electricityCost.toFixed(2));
          updates.netContribution = parseFloat(netContribution.toFixed(2));
        } else {
          // Update individual fields without recalculating
          if (arrivalSoc !== undefined) updates.arrivalSoc = newArrival;
          if (departureSoc !== undefined) updates.departureSoc = newDeparture;
          if (ratePerPercent !== undefined) updates.ratePerPercent = newRate;
        }
      }
      
      // Payment / Udaro updates - USE ATOMIC TRANSACTION
      if (creditPaid !== undefined && creditPaid !== null) {
        const transaction = await sequelize.transaction();
        try {
          const finalChargeAmount = updates.chargeAmount || parseFloat(String(session.chargeAmount)) || 0;
          const paidAmount = parseFloat(String(creditPaid)) || 0;
          
          // Determine session status based on Departure SOC ONLY
          const currentDepartureSoc = updates.departureSoc !== undefined ? updates.departureSoc : session.departureSoc;
          const calculatedSessionStatus = (currentDepartureSoc != null && currentDepartureSoc !== '') ? 'completed' : 'ongoing';
          
          // Use shared calculation utility for consistency
          const paymentDetails = calculatePaymentDetails(
            finalChargeAmount,
            paidAmount,
            calculatedSessionStatus
          );
          
          updates.creditPaid = paymentDetails.creditPaid;
          updates.outstanding = paymentDetails.outstanding;
          
          // Auto-update payment status based on what's paid (unless explicitly overridden)
          if (!paymentStatus) {
            updates.paymentStatus = paymentDetails.paymentStatus;
          }
          
          // Always set session status based on Departure SOC
          updates.sessionStatus = calculatedSessionStatus;
          
          await session.update(updates, { transaction });
          await transaction.commit();
          
          console.log(`[Session Update] ${id}: Paid Rs.${paidAmount}, Outstanding Rs.${paymentDetails.outstanding}, Status=${paymentDetails.paymentStatus}, SessionStatus=${calculatedSessionStatus}`);
        } catch (updateErr: any) {
          await transaction.rollback();
          console.error('[Session Update] Transaction failed, rolled back:', updateErr.message);
          throw updateErr;
        }
      } else {
        // Non-payment updates - still need to update session status if departure SOC changed
        if (departureSoc !== undefined) {
          const currentDepartureSoc = newDeparture;
          updates.sessionStatus = (currentDepartureSoc != null && currentDepartureSoc !== 0) ? 'completed' : 'ongoing';
        }
        
        if (Object.keys(updates).length > 0) {
          await session.update(updates);
        }
      }
      
      if (settlementMethod !== undefined) {
        await session.update({ settlementMethod: settlementMethod || null });
      }
      if (settlementDate !== undefined) {
        await session.update({ settlementDate: settlementDate || null });
      }
      
      await session.update(updates);
      
      // Reload session to get fresh data
      await session.reload();
      
      return res.status(200).json({ message: 'Session updated', session });
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (err: any) {
    console.error('[Session API Error]:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}
