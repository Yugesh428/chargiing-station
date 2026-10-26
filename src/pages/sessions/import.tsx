import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const CHARGER_MAP: any = {
  'GBT': 'GBT', 'CCS2': 'CCS2', 'GBT 40KW': 'GBT', 'CCS2 80KW': 'CCS2',
  'GBT 40kW': 'GBT', 'CCS2 80kW': 'CCS2',
};
const METHOD_MAP: any = {
  'Cash': 'Cash', 'Bank/QR': 'Bank/QR', 'Bank': 'Bank/QR', 'QR': 'Bank/QR',
  'Fonepay / QR': 'Bank/QR', 'Fonepay': 'Bank/QR', 'Credit': 'Credit',
};
const STATUS_MAP: any = {
  'Paid': 'Paid', 'Pending': 'Pending', 'Partially Paid': 'Partially Paid',
};

function normalizeRow(row: any) {
  // Handle various possible column names
  const getField = (row: any, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return undefined;
  };

  return {
    date: getField(row, 'Date', 'date', 'DATE'),
    time: getField(row, 'Time', 'time', 'TIME'),
    vehicleNo: String(getField(row, 'Vehicle No.', 'Vehicle No', 'vehicleNo', 'Vehicle Number', 'vehicle_no') || '').trim(),
    arrivalSoc: getField(row, 'Arrival SOC %', 'Arrival SOC', 'arrivalSoc', 'arrival_soc'),
    departureSoc: getField(row, 'Departure SOC %', 'Departure SOC', 'departureSoc', 'departure_soc'),
    ratePerPercent: getField(row, 'Rate Rs/%', 'Rate', 'ratePerPercent', 'rate'),
    chargerType: CHARGER_MAP[String(getField(row, 'Charger', 'chargerType', 'Charger Type') || '').trim()] || String(getField(row, 'Charger', 'chargerType') || '').trim(),
    paymentMethod: METHOD_MAP[String(getField(row, 'Payment Method', 'paymentMethod', 'payment_method') || '').trim()] || String(getField(row, 'Payment Method', 'paymentMethod') || '').trim(),
    paymentStatus: STATUS_MAP[String(getField(row, 'Payment Status', 'paymentStatus', 'payment_status') || '').trim()] || 'Paid',
    companyBrand: getField(row, 'Company/ Brand', 'Company/Brand', 'companyBrand', 'Company', 'Brand') || '',
    creditPaid: getField(row, 'Credit Paid Rs.', 'Credit Paid', 'creditPaid', 'credit_paid') || 0,
    settlementMethod: METHOD_MAP[String(getField(row, 'Settlement Method', 'settlementMethod', 'settlement_method') || '').trim()] || null,
    settlementDate: getField(row, 'Settlement Date', 'settlementDate', 'settlement_date') || null,
    operator: getField(row, 'Operator', 'operator') || '',
    remarks: getField(row, 'Remarks', 'remarks') || '',
  };
}

function validateRow(row: any, i: number): string | null {
  if (!row.date) return `Row ${i + 1}: Missing date`;
  if (!row.vehicleNo) return `Row ${i + 1}: Missing vehicle number`;
  if (row.arrivalSoc == null || row.arrivalSoc === '') return `Row ${i + 1}: Missing arrival SOC`;
  if (row.departureSoc == null || row.departureSoc === '') return `Row ${i + 1}: Missing departure SOC`;
  if (Number(row.departureSoc) <= Number(row.arrivalSoc)) return `Row ${i + 1}: Departure SOC must be > arrival`;
  if (!row.ratePerPercent) return `Row ${i + 1}: Missing rate`;
  if (!row.chargerType) return `Row ${i + 1}: Missing charger type`;
  if (!row.paymentMethod) return `Row ${i + 1}: Missing payment method`;
  return null;
}

export default function ImportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [fileName, setFileName] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setResult(null);
    setRows([]);
    setErrors([]);

    const reader = new FileReader();
    
    reader.onerror = () => {
      setErrors(['Failed to read file. Please try again.']);
      setFileName('');
    };
    
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read WITHOUT headers first to find where the real data starts
        const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
        
        console.log('📄 Total rows in sheet:', allRows.length);
        console.log('🔍 First 5 rows:', allRows.slice(0, 5));
        
        // Find the header row (contains "Date" or "Vehicle No.")
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(10, allRows.length); i++) {
          const row = allRows[i];
          const rowStr = JSON.stringify(row).toLowerCase();
          if (rowStr.includes('date') && (rowStr.includes('vehicle') || rowStr.includes('arrival'))) {
            headerRowIndex = i;
            console.log('✅ Found header row at index:', i, row);
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          throw new Error('Could not find header row with Date and Vehicle columns');
        }
        
        // Now read data starting from the header row
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        range.s.r = headerRowIndex; // Start from header row
        const newRef = XLSX.utils.encode_range(range);
        
        const raw: any[] = XLSX.utils.sheet_to_json(worksheet, { 
          range: newRef,
          defval: '', 
          raw: false 
        });

        console.log('📊 Data rows found:', raw.length);
        console.log('📋 First data row:', raw[0]);
        console.log('🔑 Column names:', Object.keys(raw[0] || {}));

        const normalized = raw.map(normalizeRow).filter(r => r.vehicleNo && r.date);
        console.log('✅ After normalization (first 2):', normalized.slice(0, 2));
        
        const errs: string[] = [];
        const valid: any[] = [];

        normalized.forEach((row, i) => {
          const err = validateRow(row, i);
          if (err) {
            errs.push(err);
            if (i < 5) console.log('❌ Validation error:', err, row);
          } else {
            const dateStr = typeof row.date === 'object' && row.date.toISOString 
              ? row.date.toISOString().slice(0, 10) 
              : String(row.date).slice(0, 10);
            valid.push({ ...row, date: dateStr });
          }
        });

        console.log('✅ Valid rows:', valid.length, '❌ Error rows:', errs.length);
        setRows(valid);
        setErrors(errs);
      } catch (error: any) {
        console.error('Parse error:', error);
        setErrors([`Failed to parse file: ${error.message}`]);
        setFileName('');
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const r = await fetch('/api/sessions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows }),
      });
      const d = await r.json();
      setResult(d);
      if (d.imported > 0) setRows([]);
    } catch (err: any) {
      setResult({ error: err.message });
    }
    setImporting(false);
  };

  return (
    <Layout activeTab="sessions" title="Import Sessions">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Bulk Import Sessions</h2>
        <p className="text-sm text-slate-500 mt-0.5">Import charging sessions from Excel (.xlsx) or CSV file</p>
      </div>

      {/* Upload */}
      <Card className="border-slate-200 bg-white mb-4">
        <CardHeader>
          <CardTitle className="text-base">Upload File</CardTitle>
          <CardDescription>Accepts .xlsx and .csv files from the Lekali EV charging log</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors bg-slate-50">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="h-10 w-10 text-blue-500 mb-3" />
              <p className="mb-2 text-sm text-slate-700 font-semibold">
                {fileName ? `📄 ${fileName}` : 'Click to upload Excel or CSV file'}
              </p>
              <p className="text-xs text-slate-500">{fileName ? 'Click to change file' : 'or drag and drop here'}</p>
              <p className="text-xs text-slate-400 mt-2">.xlsx, .csv supported</p>
            </div>
            <input type="file" accept=".xlsx,.csv" onChange={handleFile} className="hidden" />
          </label>

          {fileName && rows.length === 0 && errors.length === 0 && (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-slate-600 mt-2">Processing file...</p>
            </div>
          )}

          {fileName && (rows.length > 0 || errors.length > 0) && (
            <div className="flex gap-2">
              <Button 
                onClick={() => { setFileName(''); setRows([]); setErrors([]); setResult(null); }}
                variant="outline"
                className="flex-1"
              >
                ❌ Cancel & Upload Different File
              </Button>
            </div>
          )}
          
          <div className="p-3 bg-amber-50 rounded-md border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-1">💡 Required columns in your Excel/CSV:</p>
            <p className="text-xs text-amber-700">Date, Vehicle No., Arrival SOC %, Departure SOC %, Rate Rs/%, Charger, Payment Method, Payment Status</p>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 mb-4 ${result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {result.error ? <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />}
          <div>
            {result.error ? <p className="text-sm text-red-700">{result.error}</p> : (
              <>
                <p className="text-sm font-medium text-green-800">✅ Imported {result.imported} sessions, skipped {result.skipped}</p>
                {result.errors?.length > 0 && <ul className="mt-1 space-y-0.5">{result.errors.map((e: string, i: number) => <li key={i} className="text-xs text-yellow-700">• {e}</li>)}</ul>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 mb-4">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-yellow-800 mb-2">⚠ {errors.length} rows will be skipped:</p>
            <ul className="space-y-0.5">{errors.slice(0, 10).map((e, i) => <li key={i} className="text-xs text-yellow-700">• {e}</li>)}</ul>
            {errors.length > 10 && <p className="text-xs text-yellow-600 mt-1">...and {errors.length - 10} more</p>}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <Card className="border-green-200 bg-white shadow-md">
          <CardHeader className="pb-3 bg-green-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-green-900">✅ Ready to Import — {rows.length} valid rows</CardTitle>
                <CardDescription className="text-xs mt-1 text-green-700">Review the preview below, then click Import</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setFileName(''); setRows([]); setErrors([]); }}
                  className="border-slate-300"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing} 
                  className="bg-green-600 hover:bg-green-700 gap-2 shadow-md"
                  size="lg"
                >
                  {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  {importing ? 'Importing...' : `⚡ Import ${rows.length} Sessions`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <p className="text-xs font-semibold text-blue-900">📋 Preview (showing first 10 rows):</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    {['Date', 'Vehicle No.', 'Arrival', 'Departure', 'Rate', 'Charger', 'Method', 'Status', 'Brand'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{String(r.date).slice(0, 10)}</td>
                      <td className="px-3 py-2 text-xs font-bold text-blue-700">{r.vehicleNo}</td>
                      <td className="px-3 py-2 text-xs">{r.arrivalSoc}%</td>
                      <td className="px-3 py-2 text-xs">{r.departureSoc}%</td>
                      <td className="px-3 py-2 text-xs">{r.ratePerPercent}</td>
                      <td className="px-3 py-2 text-xs"><Badge variant="info" className="text-xs">{r.chargerType}</Badge></td>
                      <td className="px-3 py-2 text-xs">{r.paymentMethod}</td>
                      <td className="px-3 py-2 text-xs"><Badge variant={r.paymentStatus === 'Paid' ? 'success' : 'warning'} className="text-xs">{r.paymentStatus}</Badge></td>
                      <td className="px-3 py-2 text-xs text-slate-500">{r.companyBrand || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-600">...and {rows.length - 10} more rows</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
