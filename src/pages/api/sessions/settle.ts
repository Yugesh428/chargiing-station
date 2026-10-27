import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { QueryTypes } from 'sequelize';
import sequelize from '../../../config/database';
import { applyPayment } from '../../../utils/paymentCalculations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.role === 'super_admin') {
      return res.status(403).json({ message: 'Super admin cannot access operational data.' });
    }

    const tenantId = decoded.tenantId;
    const { sessionIds, settlementMethod, settlementDate, amountPaid } = req.body;

    // Validation
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ message: 'Session IDs are required' });
    }
    if (!settlementMethod) return res.status(400).json({ message: 'Settlement method is required' });
    if (!settlementDate) return res.status(400).json({ message: 'Settlement date is required' });
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      return res.status(400).json({ message: 'Amount paid must be greater than 0' });
    }

    console.log(`[Settlement] Processing payment of Rs.${amountPaid} for ${sessionIds.length} session(s)`);

    // Fetch sessions using raw SQL — most reliable
    // Build individual placeholders for UUIDs to avoid array casting issues
    const idPlaceholders = sessionIds.map((_: any, i: number) => `:id${i}`).join(', ');
    const idReplacements: any = { tenantId };
    sessionIds.forEach((id: string, i: number) => { idReplacements[`id${i}`] = id; });

    const sessions = await sequelize.query(`
      SELECT
        id,
        "vehicleNo",
        "chargeAmount"::float as "chargeAmount",
        COALESCE("creditPaid", 0)::float as "creditPaid",
        COALESCE(outstanding, 0)::float as outstanding,
        "paymentStatus",
        "sessionStatus"
      FROM charging_sessions
      WHERE id IN (${idPlaceholders})
        AND "tenantId" = :tenantId
      ORDER BY date ASC, "createdAt" ASC
    `, {
      replacements: idReplacements,
      type: QueryTypes.SELECT,
    }) as any[];

    console.log(`[Settlement] Requested ${sessionIds.length} IDs, found ${sessions.length} sessions`);

    if (sessions.length === 0) {
      return res.status(404).json({ message: 'No sessions found' });
    }

    // Calculate actual outstanding for each session using shared utility
    const sessionsWithOutstanding = sessions.map(s => {
      const chargeAmount = s.chargeAmount || 0;
      const creditPaid = s.creditPaid || 0;
      // Recalculate outstanding if needed
      const actualOutstanding = s.paymentStatus !== 'Paid'
        ? Math.max(0, chargeAmount - creditPaid)
        : 0;
      return { ...s, actualOutstanding };
    });

    const totalOutstanding = sessionsWithOutstanding.reduce((sum, s) => sum + s.actualOutstanding, 0);

    let remainingAmount = parseFloat(String(amountPaid));
    const settledSessions: any[] = [];

    // Start transaction for atomic updates
    const transaction = await sequelize.transaction();
    try {
      for (const session of sessionsWithOutstanding) {
        if (remainingAmount <= 0) break;
        if (session.actualOutstanding <= 0) continue;

        // Calculate how much to apply to this session
        const amountToApply = Math.min(remainingAmount, session.actualOutstanding);
        remainingAmount -= amountToApply;

        // Use shared utility to calculate new payment details
        const paymentDetails = applyPayment(
          session.chargeAmount,
          session.creditPaid,
          amountToApply,
          session.sessionStatus
        );

        // Update session using raw SQL
        await sequelize.query(`
          UPDATE charging_sessions
          SET
            "creditPaid" = :newCreditPaid,
            outstanding = :newOutstanding,
            "paymentStatus" = :newPaymentStatus,
            "sessionStatus" = :newSessionStatus,
            "settlementMethod" = :settlementMethod,
            "settlementDate" = :settlementDate,
            "updatedAt" = NOW()
          WHERE id = :sessionId
            AND "tenantId" = :tenantId
        `, {
          replacements: {
            newCreditPaid: paymentDetails.creditPaid,
            newOutstanding: paymentDetails.outstanding,
            newPaymentStatus: paymentDetails.paymentStatus,
            newSessionStatus: paymentDetails.sessionStatus,
            settlementMethod,
            settlementDate,
            sessionId: session.id,
            tenantId,
          },
          type: QueryTypes.UPDATE,
          transaction,
        });

        console.log(`[Settlement] Updated ${session.vehicleNo}: applied Rs.${amountToApply.toFixed(2)}, new paid Rs.${paymentDetails.creditPaid}, status=${paymentDetails.paymentStatus}`);

        settledSessions.push({
          id: session.id,
          vehicleNo: session.vehicleNo,
          amountApplied: parseFloat(amountToApply.toFixed(2)),
          paymentStatus: paymentDetails.paymentStatus,
          newOutstanding: paymentDetails.outstanding,
        });
      }

      await transaction.commit();
      console.log(`[Settlement] Transaction committed successfully. Settled ${settledSessions.length} session(s)`);
    } catch (updateErr: any) {
      await transaction.rollback();
      console.error('[Settlement] Update failed, rolled back:', updateErr.message);
      throw updateErr;
    }

    return res.status(200).json({
      message: 'Settlement processed successfully',
      settledSessions,
      totalAmount: parseFloat(String(amountPaid)),
      totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
      remainingAmount: parseFloat(remainingAmount.toFixed(2)),
      sessionsSettled: settledSessions.length,
    });

  } catch (err: any) {
    console.error('[Settlement Error]:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}
