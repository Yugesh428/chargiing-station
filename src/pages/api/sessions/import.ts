import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('\n========================================');
  console.log('🚀 SESSION IMPORT STARTED');
  console.log('========================================');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🔧 Method:', req.method);

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // === AUTHENTICATION ===
    console.log('\n--- AUTHENTICATION CHECK ---');
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('🔑 Token present:', !!token);
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    console.log('✅ Token decoded successfully');
    console.log('👤 User:', JSON.stringify({ 
      id: decoded.id, 
      email: decoded.email, 
      role: decoded.role,
      tenantId: decoded.tenantId 
    }, null, 2));

    const tenantId = decoded.role === 'super_admin' ? req.body.tenantId : decoded.tenantId;
    console.log('🏢 Using tenantId:', tenantId);

    if (!tenantId) {
      console.log('❌ No tenantId found');
      return res.status(400).json({ message: 'tenantId required' });
    }

    // === LOAD MODELS ===
    console.log('\n--- LOADING MODELS ---');
    const { ChargingSession, Tenant } = await import('../../../models');
    console.log('✅ Models loaded successfully');

    // === VALIDATE INPUT ===
    console.log('\n--- VALIDATING INPUT ---');
    const { rows } = req.body;
    console.log('📊 Total rows received:', rows?.length || 0);

    if (!rows || !Array.isArray(rows)) {
      console.log('❌ Invalid rows data');
      return res.status(400).json({ message: 'rows array required' });
    }

    console.log('📋 First row sample:', JSON.stringify(rows[0], null, 2));

    // === FETCH TENANT SETTINGS ===
    console.log('\n--- FETCHING TENANT SETTINGS ---');
    const tenant = await Tenant.findByPk(tenantId);
    
    if (!tenant) {
      console.log('❌ Tenant not found:', tenantId);
      return res.status(404).json({ message: 'Tenant not found' });
    }
    
    const electricityRate = parseFloat(String(tenant.electricityRate)) || 17;
    const neaCostRate = parseFloat(String(tenant.neaCostRate)) || 9.35;
    
    console.log('✅ Tenant found:', tenant.stationName);
    console.log('⚡ Electricity Rate:', electricityRate);
    console.log('💰 NEA Cost Rate:', neaCostRate);

    // === PROCESS ROWS ===
    console.log('\n--- PROCESSING ROWS ---');
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const detailedLogs: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      
      console.log(`\n📦 Processing Row ${rowNum}/${rows.length}`);
      console.log('Raw data:', JSON.stringify(row, null, 2));

      try {
        const {
          date, vehicleNo, arrivalSoc, departureSoc, ratePerPercent,
          chargerType, paymentMethod, paymentStatus, companyBrand,
          operator, remarks, creditPaid = 0, settlementMethod, settlementDate,
        } = row;

        // Validation
        console.log(`  🔍 Validating fields...`);
        const validationLog: any = {
          rowNum,
          date: date || 'MISSING',
          vehicleNo: vehicleNo || 'MISSING',
          arrivalSoc: arrivalSoc ?? 'MISSING',
          departureSoc: departureSoc ?? 'MISSING',
          ratePerPercent: ratePerPercent || 'MISSING',
          chargerType: chargerType || 'MISSING',
          paymentMethod: paymentMethod || 'MISSING',
          paymentStatus: paymentStatus || 'MISSING',
        };
        console.log('  📋 Validation:', JSON.stringify(validationLog, null, 2));

        if (!date || !vehicleNo || arrivalSoc == null || departureSoc == null || !ratePerPercent || !chargerType || !paymentMethod || !paymentStatus) {
          const missingFields = [];
          if (!date) missingFields.push('date');
          if (!vehicleNo) missingFields.push('vehicleNo');
          if (arrivalSoc == null) missingFields.push('arrivalSoc');
          if (departureSoc == null) missingFields.push('departureSoc');
          if (!ratePerPercent) missingFields.push('ratePerPercent');
          if (!chargerType) missingFields.push('chargerType');
          if (!paymentMethod) missingFields.push('paymentMethod');
          if (!paymentStatus) missingFields.push('paymentStatus');
          
          const errorMsg = `Row ${rowNum}: Missing required fields: ${missingFields.join(', ')} for vehicle ${vehicleNo}`;
          console.log(`  ❌ ${errorMsg}`);
          skipped++;
          errors.push(errorMsg);
          detailedLogs.push({ rowNum, status: 'SKIPPED', reason: errorMsg, data: row });
          continue;
        }

        // SOC Validation
        const dep = Number(departureSoc);
        const arr = Number(arrivalSoc);
        console.log(`  🔋 SOC: Arrival=${arr}%, Departure=${dep}%`);

        if (dep <= arr || arr < 0 || dep > 100) {
          const errorMsg = `Row ${rowNum}: Invalid SOC for vehicle ${vehicleNo} on ${date} (arr=${arr}, dep=${dep})`;
          console.log(`  ❌ ${errorMsg}`);
          skipped++;
          errors.push(errorMsg);
          detailedLogs.push({ rowNum, status: 'SKIPPED', reason: errorMsg, data: row });
          continue;
        }

        // Check duplicate
        console.log(`  🔍 Checking for duplicates...`);
        const dup = await ChargingSession.findOne({ 
          where: { tenantId, vehicleNo: String(vehicleNo), date, departureSoc: dep } 
        });
        
        if (dup) {
          const errorMsg = `Row ${rowNum}: Duplicate session for vehicle ${vehicleNo} on ${date}`;
          console.log(`  ⏭️  ${errorMsg}`);
          skipped++;
          detailedLogs.push({ rowNum, status: 'DUPLICATE', data: row });
          continue;
        }

        // Calculate values
        console.log(`  🧮 Calculating values...`);
        const chargedPercent = dep - arr;
        const chargeAmount = chargedPercent * Number(ratePerPercent);
        const usedKwh = chargeAmount / electricityRate;
        const electricityCost = usedKwh * neaCostRate;
        const netContribution = chargeAmount - electricityCost;
        let outstanding = Number(creditPaid) > 0 
          ? Math.max(0, chargeAmount - Number(creditPaid)) 
          : (paymentMethod === 'Credit' ? chargeAmount : (paymentStatus === 'Pending' ? chargeAmount : 0));

        const calculations = {
          chargedPercent,
          chargeAmount: chargeAmount.toFixed(2),
          usedKwh: usedKwh.toFixed(3),
          electricityCost: electricityCost.toFixed(2),
          netContribution: netContribution.toFixed(2),
          outstanding: outstanding.toFixed(2),
        };
        console.log('  📊 Calculations:', JSON.stringify(calculations, null, 2));

        // Get visit count
        const visitCount = await ChargingSession.count({ 
          where: { tenantId, vehicleNo: String(vehicleNo) } 
        });
        console.log(`  🚗 Visit count for ${vehicleNo}: ${visitCount + 1}`);

        // Prepare session data
        const sessionData: any = {
          tenantId, 
          date, 
          vehicleNo: String(vehicleNo).trim(),
          arrivalSoc: arr, 
          departureSoc: dep,
          chargedPercent, 
          ratePerPercent: Number(ratePerPercent),
          chargeAmount, 
          visitNo: visitCount + 1,
          chargerType: String(chargerType).trim(),
          paymentMethod: String(paymentMethod).trim(),
          paymentStatus: String(paymentStatus).trim(),
          operator, 
          remarks,
          usedKwh: parseFloat(usedKwh.toFixed(3)),
          electricityRate,
          electricityCost: parseFloat(electricityCost.toFixed(2)),
          netContribution: parseFloat(netContribution.toFixed(2)),
          creditPaid: Number(creditPaid),
          outstanding: parseFloat(outstanding.toFixed(2)),
          settlementMethod: settlementMethod || null,
          settlementDate: settlementDate || null,
          companyBrand: companyBrand || null,
        };

        console.log('  💾 Attempting to create session...');
        console.log('  📄 Session data:', JSON.stringify(sessionData, null, 2));

        await ChargingSession.create(sessionData);
        
        console.log(`  ✅ Row ${rowNum} imported successfully!`);
        imported++;
        detailedLogs.push({ rowNum, status: 'SUCCESS', vehicleNo, date });

      } catch (rowErr: any) {
        const errorMsg = `Row ${rowNum}: ${rowErr.message}`;
        console.log(`  ❌ ERROR: ${errorMsg}`);
        console.error('  📜 Full error:', rowErr);
        console.error('  🔍 Error stack:', rowErr.stack);
        
        skipped++;
        errors.push(errorMsg);
        detailedLogs.push({ 
          rowNum, 
          status: 'ERROR', 
          error: rowErr.message,
          errorDetail: rowErr.toString(),
          data: row 
        });
      }
    }

    // === FINAL SUMMARY ===
    console.log('\n========================================');
    console.log('📊 IMPORT SUMMARY');
    console.log('========================================');
    console.log('✅ Imported:', imported);
    console.log('⏭️  Skipped:', skipped);
    console.log('❌ Errors:', errors.length);
    console.log('📋 Detailed logs:', JSON.stringify(detailedLogs, null, 2));
    console.log('========================================\n');

    res.status(200).json({ 
      imported, 
      skipped, 
      errors: errors.slice(0, 20), 
      message: `✅ Imported ${imported} sessions, skipped ${skipped}`,
      detailedLogs: detailedLogs.slice(0, 50) // First 50 detailed logs
    });

  } catch (err: any) {
    console.error('\n❌ CRITICAL ERROR IN IMPORT');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Full error:', JSON.stringify(err, null, 2));
    
    res.status(500).json({ 
      message: err.message || 'Server error',
      error: err.toString(),
      stack: err.stack
    });
  }
}
