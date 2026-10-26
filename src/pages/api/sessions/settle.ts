import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Super admin cannot access sessions
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data. Please login as tenant admin.' });
    }
    
    const tenantId = decoded.tenantId;
    const { sessionIds, settlementMethod, settlementDate, amountPaid } = req.body;

    // Validation
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ message: 'Session IDs are required' });
    }
    if (!settlementMethod) {
      return res.status(400).json({ message: 'Settlement method is required' });
    }
    if (!settlementDate) {
      return res.status(400).json({ message: 'Settlement date is required' });
    }
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      return res.status(400).json({ message: 'Amount paid must be greater than 0' });
    }

    const { ChargingSession } = await import('../../../models');
    
    // Fetch all sessions that need to be settled
    const sessions = await ChargingSession.findAll({
      where: {
        id: sessionIds,
        tenantId: tenantId,
      },
      order: [['date', 'ASC'], ['createdAt', 'ASC']], // Oldest first for fair settlement
    });

    if (sessions.length === 0) {
      return res.status(404).json({ message: 'No sessions found' });
    }

    if (sessions.length !== sessionIds.length) {
      return res.status(400).json({ message: 'Some sessions not found or do not belong to your tenant' });
    }

    // Calculate total outstanding - handle cases where outstanding is NULL/0
    const totalOutstanding = sessions.reduce((sum, session) => {
      const chargeAmount = parseFloat(String(session.chargeAmount)) || 0;
      const creditPaid = parseFloat(String(session.creditPaid)) || 0;
      const outstanding = parseFloat(String(session.outstanding));
      
      // If outstanding is not set, calculate it
      const actualOutstanding = (outstanding !== null && outstanding !== undefined && !isNaN(outstanding)) 
        ? outstanding 
        : (chargeAmount - creditPaid);
      
      return sum + Math.max(0, actualOutstanding);
    }, 0);

    let remainingAmount = parseFloat(amountPaid);
    const settledSessions = [];

    // Distribute payment across sessions (oldest first)
    for (const session of sessions) {
      if (remainingAmount <= 0) break;

      const chargeAmount = parseFloat(String(session.chargeAmount)) || 0;
      const currentCreditPaid = parseFloat(String(session.creditPaid)) || 0;
      const outstanding = parseFloat(String(session.outstanding));
      
      // Calculate actual outstanding - if not set, calculate from charge amount
      const currentOutstanding = (outstanding !== null && outstanding !== undefined && !isNaN(outstanding))
        ? outstanding
        : (chargeAmount - currentCreditPaid);
      
      if (currentOutstanding <= 0) {
        // Session already fully paid, skip
        continue;
      }

      let amountToApply = 0;
      let newPaymentStatus = '';
      let newSessionStatus = '';

      if (remainingAmount >= currentOutstanding) {
        // Full payment for this session
        amountToApply = currentOutstanding;
        remainingAmount -= currentOutstanding;
        newPaymentStatus = 'Paid';
        newSessionStatus = 'completed';
      } else {
        // Partial payment for this session
        amountToApply = remainingAmount;
        remainingAmount = 0;
        newPaymentStatus = 'Partially Paid';
        newSessionStatus = 'pending_payment'; // Still pending
      }

      const newCreditPaid = currentCreditPaid + amountToApply;
      const newOutstanding = Math.max(0, chargeAmount - newCreditPaid);

      console.log(`[Settlement] Session ${session.id}:`);
      console.log(`  Charge Amount: Rs. ${chargeAmount}`);
      console.log(`  Previous Credit Paid: Rs. ${currentCreditPaid}`);
      console.log(`  Amount Applied Now: Rs. ${amountToApply}`);
      console.log(`  New Credit Paid: Rs. ${newCreditPaid}`);
      console.log(`  New Outstanding: Rs. ${newOutstanding}`);
      console.log(`  Payment Status: ${newPaymentStatus}`);

      await session.update({
        creditPaid: parseFloat(newCreditPaid.toFixed(2)),
        outstanding: parseFloat(newOutstanding.toFixed(2)),
        paymentStatus: newPaymentStatus,
        sessionStatus: newSessionStatus,
        settlementMethod: settlementMethod,
        settlementDate: settlementDate,
      });

      settledSessions.push({
        id: session.id,
        vehicleNo: session.vehicleNo,
        amountApplied: parseFloat(amountToApply.toFixed(2)),
        paymentStatus: newPaymentStatus,
      });
    }

    return res.status(200).json({
      message: 'Settlement processed successfully',
      settledSessions: settledSessions,
      totalAmount: parseFloat(amountPaid),
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      remainingAmount: parseFloat(remainingAmount.toFixed(2)),
      sessionsSettled: settledSessions.length,
    });

  } catch (err: any) {
    console.error('Settlement error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
