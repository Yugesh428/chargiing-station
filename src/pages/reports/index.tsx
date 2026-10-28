import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

type Tab = 'period' | 'daily' | 'monthly' | 'vehicles' | 'settlement' | 'expenses';

const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => new Date().toISOString().slice(0, 7);

function SummaryCard({ label, value, color = '' }: { label: string; value: string | number; color?: string }) {
  // Format the value and handle NaN
  const displayValue = typeof value === 'number' 
    ? (isNaN(value) ? '0' : value.toLocaleString())
    : (value === 'NaN' || value === 'undefined' ? '0' : value);
    
  return (
    <Card className="border-slate-200 shadow-none">
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-lg font-bold ${color || 'text-slate-900'}`}>{displayValue}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({ title, data, columns, onExport }: { 
  title: string; 
  data: any[] | null | undefined;
  columns?: { key: string; label: string; format?: (v: any) => string }[];
  onExport?: () => void;
}) {
  if (!data || data.length === 0) return null;
  
  const defaultColumns = [
    { key: 'category', label: 'Category', format: (v: any) => String(v || '') },
    { key: 'sessions', label: 'Sessions', format: (v: any) => Number(v || 0).toLocaleString() },
    { key: 'revenue', label: 'Revenue Rs.', format: (v: any) => Number(v || 0).toLocaleString() },
  ];
  
  const cols = columns || defaultColumns;
  const [showAll, setShowAll] = useState(false);
  
  // Show only first 10 rows by default to avoid overwhelming UI
  const displayData = showAll ? data : data.slice(0, 10);
  const hasMore = data.length > 10;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {onExport && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onExport}
            className="h-7 text-xs gap-1"
          >
            <Download className="h-3 w-3" />
            Export
          </Button>
        )}
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {cols.map((col, idx) => (
                <th key={idx} className={`px-3 py-2 text-xs font-medium text-slate-500 ${idx === 0 ? 'text-left' : 'text-right'}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayData.map((row: any, idx: number) => (
              <tr key={idx}>
                {cols.map((col, colIdx) => {
                  let value;
                  if (col.key === 'category') {
                    // For category column, check all possible category field names
                    value = row.ratePerPercent || row.chargerType || row.paymentMethod || row.sessionStatus || row.paymentStatus || row.expenseType || '';
                  } else {
                    // For other columns, use the specified key directly
                    value = row[col.key];
                  }
                  
                  return (
                    <td key={colIdx} className={`px-3 py-2 ${colIdx === 0 ? 'text-slate-700 font-medium' : 'text-right text-slate-600 font-semibold'}`}>
                      {col.format ? col.format(value) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="border-t border-slate-200 p-2 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showAll ? `Show Less (${data.length} total)` : `Show All ${data.length} Rows (${data.length - 10} more)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('period');
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  // Period
  const [pStart, setPStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [pEnd, setPEnd] = useState(today());
  const [periodData, setPeriodData] = useState<any>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  // Daily
  const [dailyDate, setDailyDate] = useState(today());
  const [dailyData, setDailyData] = useState<any>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Monthly
  const [month, setMonth] = useState(thisMonth());
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Vehicles
  const [vStart, setVStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [vEnd, setVEnd] = useState(today());
  const [vehiclesData, setVehiclesData] = useState<any>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  // Settlement
  const [sStart, setSStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [sEnd, setSEnd] = useState(today());
  const [settlementData, setSettlementData] = useState<any>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);

  // Expenses
  const [eStart, setEStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [eEnd, setEEnd] = useState(today());
  const [expensesData, setExpensesData] = useState<any>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);

  const fetchPeriod = async () => {
    setPeriodLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/period?startDate=${pStart}&endDate=${pEnd}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPeriodData(await res.json());
    } finally { setPeriodLoading(false); }
  };

  const fetchDaily = async () => {
    setDailyLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/daily?date=${dailyDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDailyData(await res.json());
    } finally { setDailyLoading(false); }
  };

  const fetchMonthly = async () => {
    setMonthlyLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/monthly?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMonthlyData(await res.json());
    } finally { setMonthlyLoading(false); }
  };

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/vehicles?startDate=${vStart}&endDate=${vEnd}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setVehiclesData(await res.json());
    } finally { setVehiclesLoading(false); }
  };

  const fetchSettlement = async () => {
    setSettlementLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/settlement?startDate=${sStart}&endDate=${sEnd}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSettlementData(await res.json());
    } finally { setSettlementLoading(false); }
  };

  const fetchExpenses = async () => {
    setExpensesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/expenses?startDate=${eStart}&endDate=${eEnd}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setExpensesData(await res.json());
    } finally { setExpensesLoading(false); }
  };

  // ── Export Functions ──────────────────────────────────────────────────────
  const exportReport = async (format: 'csv' | 'excel') => {
    setExporting(format);
    try {
      let filename = '';
      let sections: any[] = [];

      if (activeTab === 'period' && periodData) {
        filename = `PeriodReport_${pStart}_to_${pEnd}`;
        
        sections = [
          ['PERIOD REPORT'],
          [`From ${pStart} to ${pEnd}`],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['SUMMARY OVERVIEW'],
          ['═══════════════════════════════════════════════════════'],
          ['Metric', 'Value'],
          ['Total Sessions', periodData.summary?.totalSessions || 0],
          ['Unique Vehicles', periodData.summary?.uniqueVehicles || 0],
          ['Total Revenue (Gross)', `Rs. ${(periodData.summary?.totalRevenue || 0).toLocaleString()}`],
          ['Total Collected (Cash Flow)', `Rs. ${(periodData.summary?.totalCollected || 0).toLocaleString()}`],
          ['Total Outstanding', `Rs. ${(periodData.summary?.totalOutstanding || 0).toLocaleString()}`],
          ['Regular Outstanding', `Rs. ${(periodData.summary?.regularOutstanding || 0).toLocaleString()}`],
          ['Udaro Outstanding', `Rs. ${(periodData.summary?.udaroOutstanding || 0).toLocaleString()}`],
          ['Electricity Cost', `Rs. ${(periodData.summary?.totalElectricityCost || 0).toLocaleString()}`],
          ['Net Contribution', `Rs. ${(periodData.summary?.totalNetContribution || 0).toLocaleString()}`],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['SESSION STATUS BREAKDOWN'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Count'],
          ['Ongoing', periodData.summary?.ongoingSessions || 0],
          ['Pending Payment', periodData.summary?.pendingPaymentSessions || 0],
          ['Completed', periodData.summary?.completedSessions || 0],
          ['Settlement (Udaro)', periodData.summary?.udaroSessions || 0],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['FINANCIAL ANALYSIS'],
          ['═══════════════════════════════════════════════════════'],
          ['Metric', 'Amount (Rs)'],
          ['Udaro Revenue', (periodData.summary?.udaroRevenue || 0).toLocaleString()],
          ['Udaro Collected', (periodData.summary?.udaroCollected || 0).toLocaleString()],
          ['Udaro Outstanding', (periodData.summary?.udaroOutstanding || 0).toLocaleString()],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY RATE'],
          ['═══════════════════════════════════════════════════════'],
          ['Rate/Percent', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
          ...(periodData.byRate || []).map((r: any) => [r.ratePerPercent, r.sessions, r.revenue, r.collected, r.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY CHARGER TYPE'],
          ['═══════════════════════════════════════════════════════'],
          ['Charger', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
          ...(periodData.byCharger || []).map((c: any) => [c.chargerType, c.sessions, c.revenue, c.collected, c.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY PAYMENT METHOD'],
          ['═══════════════════════════════════════════════════════'],
          ['Method', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
          ...(periodData.byMethod || []).map((m: any) => [m.paymentMethod, m.sessions, m.revenue, m.collected, m.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY SESSION STATUS'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Sessions', 'Revenue Rs.', 'Outstanding Rs.'],
          ...(periodData.byStatus || []).map((s: any) => [s.sessionStatus, s.sessions, s.revenue, s.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY PAYMENT STATUS'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Sessions', 'Revenue Rs.', 'Outstanding Rs.'],
          ...(periodData.byPaymentStatus || []).map((p: any) => [p.paymentStatus, p.sessions, p.revenue, p.outstanding]),
        ];
      } else if (activeTab === 'daily' && dailyData) {
        filename = `DailyReport_${dailyDate}`;
        
        sections = [
          ['DAILY CLOSING REPORT'],
          [`Date: ${dailyDate}`],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['SUMMARY OVERVIEW'],
          ['═══════════════════════════════════════════════════════'],
          ['Metric', 'Value'],
          ['Sessions', dailyData.summary.sessions],
          ['Unique Vehicles', dailyData.summary.uniqueVehicles],
          ['Total Revenue', `Rs. ${dailyData.summary.revenue.toLocaleString()}`],
          ['Total Collected', `Rs. ${dailyData.summary.totalCollected.toLocaleString()}`],
          ['Cash Collected', `Rs. ${dailyData.summary.cashCollected.toLocaleString()}`],
          ['Bank/QR Collected', `Rs. ${dailyData.summary.bankCollected.toLocaleString()}`],
          ['Outstanding', `Rs. ${dailyData.summary.outstanding.toLocaleString()}`],
          ['Electricity Cost', `Rs. ${dailyData.summary.electricityCost.toLocaleString()}`],
          ['Other Expenses', `Rs. ${dailyData.summary.totalExpenses.toLocaleString()}`],
          ['Net Profit', `Rs. ${dailyData.summary.netProfit.toLocaleString()}`],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['SESSION STATUS BREAKDOWN'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Count'],
          ['Ongoing', dailyData.summary.ongoingSessions || 0],
          ['Pending Payment', dailyData.summary.pendingPaymentSessions || 0],
          ['Completed', dailyData.summary.completedSessions || 0],
          ['Settlement (Udaro)', dailyData.summary.udaroSessions || 0],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['PAYMENT & SETTLEMENT ANALYSIS'],
          ['═══════════════════════════════════════════════════════'],
          ['Metric', 'Amount (Rs)'],
          ['Credit Sales Today', dailyData.summary.creditSales.toLocaleString()],
          ['Credit Collected', dailyData.summary.creditCollected.toLocaleString()],
          ['Total Outstanding', dailyData.summary.outstanding.toLocaleString()],
          ['Regular Outstanding', dailyData.summary.regularOutstanding.toLocaleString()],
          ['Udaro Outstanding', dailyData.summary.udaroOutstanding.toLocaleString()],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY RATE'],
          ['═══════════════════════════════════════════════════════'],
          ['Rate/Percent', 'Sessions', 'Revenue Rs.'],
          ...(dailyData.byRate || []).map((r: any) => [r.ratePerPercent, r.sessions, r.revenue]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY CHARGER'],
          ['═══════════════════════════════════════════════════════'],
          ['Charger', 'Sessions', 'Revenue Rs.'],
          ...(dailyData.byCharger || []).map((c: any) => [c.chargerType, c.sessions, c.revenue]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY SESSION STATUS'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Sessions', 'Outstanding Rs.'],
          ...(dailyData.byStatus || []).map((s: any) => [s.sessionStatus, s.sessions, s.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY PAYMENT METHOD'],
          ['═══════════════════════════════════════════════════════'],
          ['Method', 'Sessions', 'Collected Rs.'],
          ...(dailyData.byPaymentMethod || []).map((p: any) => [p.paymentMethod, p.sessions, p.collected]),
        ];

        if (dailyData.expensesByType && dailyData.expensesByType.length > 0) {
          sections.push(
            [],
            ['═══════════════════════════════════════════════════════'],
            ['EXPENSES BY TYPE'],
            ['═══════════════════════════════════════════════════════'],
            ['Type', 'Amount (Rs)'],
            ...(dailyData.expensesByType || []).map((e: any) => [e.expenseType, e.total])
          );
        }
      } else if (activeTab === 'monthly' && monthlyData && monthlyData.pnl) {
        filename = `MonthlyPL_${month}`;
        
        sections = [
          ['MONTHLY P&L REPORT'],
          [`Month: ${month}`],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['SUMMARY OVERVIEW'],
          ['═══════════════════════════════════════════════════════'],
          ['Metric', 'Value'],
          ['Total Sessions', monthlyData.summary?.sessions || 0],
          ['Total Revenue', `Rs. ${(monthlyData.summary?.revenue || 0).toLocaleString()}`],
          ['Total Collected', `Rs. ${(monthlyData.summary?.totalCollected || 0).toLocaleString()}`],
          ['Net Profit', `Rs. ${monthlyData.pnl.netProfit.toLocaleString()}`],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['SESSION STATUS BREAKDOWN'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Count'],
          ['Ongoing', monthlyData.summary?.ongoingSessions || 0],
          ['Pending Payment', monthlyData.summary?.pendingPaymentSessions || 0],
          ['Completed', monthlyData.summary?.completedSessions || 0],
          ['Settlement (Udaro)', monthlyData.summary?.udaroSessions || 0],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['PROFIT & LOSS STATEMENT'],
          ['═══════════════════════════════════════════════════════'],
          ['Item', 'Amount (Rs)'],
          ['Charging Revenue', `+${monthlyData.pnl.revenue.toLocaleString()}`],
          ['Electricity Cost (NEA)', `-${monthlyData.pnl.electricityCost.toLocaleString()}`],
          ['Variable / Other Expenses', `-${monthlyData.pnl.variableExpenses.toLocaleString()}`],
          ['Staff Cost', `-${monthlyData.pnl.staffCost.toLocaleString()}`],
          ['Monthly Rent', `-${monthlyData.pnl.rent.toLocaleString()}`],
          ['Other Fixed Cost', `-${monthlyData.pnl.otherFixed.toLocaleString()}`],
          [],
          ['Total Cost', monthlyData.pnl.totalCost.toLocaleString()],
          ['Net Profit', monthlyData.pnl.netProfit.toLocaleString()],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['PAYMENT & SETTLEMENT ANALYSIS'],
          ['═══════════════════════════════════════════════════════'],
          ['Metric', 'Amount (Rs)'],
          ['Cash Revenue', monthlyData.paymentBreakdown.cash.toLocaleString()],
          ['Bank/QR Revenue', monthlyData.paymentBreakdown.bankQr.toLocaleString()],
          ['Credit Revenue', monthlyData.paymentBreakdown.credit.toLocaleString()],
          ['Total Outstanding', (monthlyData.summary?.outstanding || 0).toLocaleString()],
          ['Regular Outstanding', (monthlyData.summary?.regularOutstanding || 0).toLocaleString()],
          ['Udaro Outstanding', (monthlyData.summary?.udaroOutstanding || 0).toLocaleString()],
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY RATE'],
          ['═══════════════════════════════════════════════════════'],
          ['Rate/Percent', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
          ...(monthlyData.byRate || []).map((r: any) => [r.ratePerPercent, r.sessions, r.revenue, r.collected, r.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY CHARGER'],
          ['═══════════════════════════════════════════════════════'],
          ['Charger', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
          ...(monthlyData.byCharger || []).map((c: any) => [c.chargerType, c.sessions, c.revenue, c.collected, c.outstanding]),
          [],
          ['═══════════════════════════════════════════════════════'],
          ['BY SESSION STATUS'],
          ['═══════════════════════════════════════════════════════'],
          ['Status', 'Sessions', 'Outstanding Rs.'],
          ...(monthlyData.byStatus || []).map((s: any) => [s.sessionStatus, s.sessions, s.outstanding]),
        ];

        if (monthlyData.expensesByType && monthlyData.expensesByType.length > 0) {
          sections.push(
            [],
            ['═══════════════════════════════════════════════════════'],
            ['VARIABLE EXPENSES BY TYPE'],
            ['═══════════════════════════════════════════════════════'],
            ['Type', 'Amount (Rs)'],
            ...(monthlyData.expensesByType || []).map((e: any) => [e.expenseType, e.total])
          );
        }
      } else {
        toast({ title: 'No data', description: 'Generate a report first before exporting.', variant: 'destructive' });
        return;
      }

      await performExport(sections, filename, format);
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Individual section export function
  const exportSection = async (sectionName: string, data: any[], columns: string[], format: 'csv' | 'excel') => {
    try {
      const filename = `${activeTab}_${sectionName}_${activeTab === 'period' ? `${pStart}_to_${pEnd}` : activeTab === 'daily' ? dailyDate : month}`;
      const sections = [
        [sectionName.toUpperCase()],
        [],
        columns,
        ...data
      ];
      await performExport(sections, filename, format);
      toast({ title: 'Exported', description: `${filename}.${format === 'csv' ? 'csv' : 'xlsx'}` });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  // Shared export logic
  const performExport = async (sections: any[], filename: string, format: 'csv' | 'excel') => {
    if (format === 'csv') {
      const escape = (v: any) => {
        if (v === null || v === undefined || v === '') return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = sections.map(row => 
        Array.isArray(row) ? row.map(escape).join(',') : row
      ).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${filename}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const XLSX = (await import('xlsx')).default || await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet(sections);
      ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'period') fetchPeriod();
    else if (activeTab === 'daily') fetchDaily();
    else if (activeTab === 'monthly') fetchMonthly();
    else if (activeTab === 'vehicles') fetchVehicles();
    else if (activeTab === 'settlement') fetchSettlement();
    else if (activeTab === 'expenses') fetchExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'period', label: 'Period Report' },
    { id: 'daily', label: 'Daily Closing' },
    { id: 'monthly', label: 'Monthly P&L' },
    { id: 'vehicles', label: 'Vehicle Report' },
    { id: 'settlement', label: 'Settlement Report' },
    { id: 'expenses', label: 'Expense Report' },
  ];

  return (
    <Layout activeTab="reports" title="Reports">
      <Toaster />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500 mt-0.5">Financial reports and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportReport('csv')}
            disabled={exporting === 'csv'}
            className="gap-1.5"
          >
            {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportReport('excel')}
            disabled={exporting === 'excel'}
            className="gap-1.5"
          >
            {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Excel
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Period Report */}
      {activeTab === 'period' && (
        <div className="space-y-6">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Start Date</Label>
              <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">End Date</Label>
              <Input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <Button onClick={fetchPeriod} disabled={periodLoading} className="bg-blue-600 hover:bg-blue-700 h-9">
              {periodLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Generate
            </Button>
          </div>

          {periodLoading && <div className="flex items-center text-slate-400 py-8"><Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading...</div>}

          {periodData && !periodLoading && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="Total Sessions" value={periodData.summary?.totalSessions || 0} />
                <SummaryCard label="Unique Vehicles" value={periodData.summary?.uniqueVehicles || 0} />
                <SummaryCard label="Total Revenue" value={`Rs. ${(Number(periodData.summary?.totalRevenue) || 0).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Total Collected" value={`Rs. ${(Number(periodData.summary?.totalCollected) || 0).toLocaleString()}`} color="text-blue-700" />
                <SummaryCard label="Electricity Cost" value={`Rs. ${(Number(periodData.summary?.totalElectricityCost) || 0).toLocaleString()}`} color="text-orange-600" />
                <SummaryCard label="Net Contribution" value={`Rs. ${(Number(periodData.summary?.totalNetContribution) || 0).toLocaleString()}`} color={(periodData.summary?.totalNetContribution || 0) >= 0 ? 'text-green-700' : 'text-red-600'} />
                <SummaryCard label="Total Outstanding" value={`Rs. ${(Number(periodData.summary?.totalOutstanding) || 0).toLocaleString()}`} color="text-red-600" />
                <SummaryCard label="Udaro Outstanding" value={`Rs. ${(Number(periodData.summary?.udaroOutstanding) || 0).toLocaleString()}`} color="text-purple-600" />
              </div>

              {/* Session Status Breakdown */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Session Status Overview</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Ongoing</p>
                      <p className="font-bold text-blue-600">{periodData.summary?.ongoingSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pending Payment</p>
                      <p className="font-bold text-orange-600">{periodData.summary?.pendingPaymentSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Completed</p>
                      <p className="font-bold text-green-600">{periodData.summary?.completedSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Settlement (Udaro)</p>
                      <p className="font-bold text-purple-600">{periodData.summary?.udaroSessions || 0} sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Breakdown */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Revenue (Gross)</p>
                      <p className="font-bold text-green-700">Rs. {(Number(periodData.summary?.totalRevenue) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Collected (Actual Cash Flow)</p>
                      <p className="font-bold text-blue-700">Rs. {(Number(periodData.summary?.totalCollected) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Outstanding</p>
                      <p className="font-bold text-red-600">Rs. {(Number(periodData.summary?.totalOutstanding) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Regular Outstanding</p>
                      <p className="font-bold text-orange-600">Rs. {(Number(periodData.summary?.regularOutstanding) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Udaro Revenue</p>
                      <p className="font-bold text-purple-600">Rs. {(Number(periodData.summary?.udaroRevenue) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Udaro Collected</p>
                      <p className="font-bold text-purple-700">Rs. {(Number(periodData.summary?.udaroCollected) || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BreakdownTable 
                  title="By Rate" 
                  data={periodData.byRate}
                  columns={[
                    { key: 'category', label: 'Rate/Percent', format: (v) => `Rs. ${v}` },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByRate',
                    (periodData.byRate || []).map((r: any) => [r.ratePerPercent, r.sessions, r.revenue, r.collected, r.outstanding]),
                    ['Rate/Percent', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Charger Type" 
                  data={periodData.byCharger}
                  columns={[
                    { key: 'category', label: 'Charger', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByCharger',
                    (periodData.byCharger || []).map((c: any) => [c.chargerType, c.sessions, c.revenue, c.collected, c.outstanding]),
                    ['Charger', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Payment Method" 
                  data={periodData.byMethod}
                  columns={[
                    { key: 'category', label: 'Method', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'collected', label: 'Collected Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByPaymentMethod',
                    (periodData.byMethod || []).map((m: any) => [m.paymentMethod, m.sessions, m.revenue, m.collected, m.outstanding]),
                    ['Method', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Session Status" 
                  data={periodData.byStatus}
                  columns={[
                    { key: 'category', label: 'Status', format: (v) => v.replace('_', ' ').toUpperCase() },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'BySessionStatus',
                    (periodData.byStatus || []).map((s: any) => [s.sessionStatus, s.sessions, s.revenue, s.outstanding]),
                    ['Status', 'Sessions', 'Revenue Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Payment Status" 
                  data={periodData.byPaymentStatus}
                  columns={[
                    { key: 'category', label: 'Status', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'outstanding', label: 'Outstanding Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByPaymentStatus',
                    (periodData.byPaymentStatus || []).map((p: any) => [p.paymentStatus, p.sessions, p.revenue, p.outstanding]),
                    ['Status', 'Sessions', 'Revenue Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Daily Closing */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Date</Label>
              <Input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <Button onClick={fetchDaily} disabled={dailyLoading} className="bg-blue-600 hover:bg-blue-700 h-9">
              {dailyLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Generate
            </Button>
          </div>

          {dailyLoading && <div className="flex items-center text-slate-400 py-8"><Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading...</div>}

          {dailyData && !dailyLoading && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <SummaryCard label="Sessions" value={String(dailyData.summary.sessions)} />
                <SummaryCard label="Unique Vehicles" value={String(dailyData.summary.uniqueVehicles)} />
                <SummaryCard label="Total Revenue" value={`Rs. ${Number(dailyData.summary.revenue).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Total Collected" value={`Rs. ${Number(dailyData.summary.totalCollected).toLocaleString()}`} color="text-blue-700" />
                <SummaryCard label="Outstanding" value={`Rs. ${Number(dailyData.summary.outstanding).toLocaleString()}`} color={dailyData.summary.outstanding > 0 ? 'text-red-600' : ''} />
                <SummaryCard label="Cash Collected" value={`Rs. ${Number(dailyData.summary.cashCollected).toLocaleString()}`} />
                <SummaryCard label="Bank/QR" value={`Rs. ${Number(dailyData.summary.bankCollected).toLocaleString()}`} />
                <SummaryCard label="Electricity Cost" value={`Rs. ${Number(dailyData.summary.electricityCost).toLocaleString()}`} color="text-orange-600" />
                <SummaryCard label="Other Expenses" value={`Rs. ${Number(dailyData.summary.totalExpenses).toLocaleString()}`} />
                <SummaryCard label="Net Profit" value={`Rs. ${Number(dailyData.summary.netProfit).toLocaleString()}`} color={dailyData.summary.netProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>

              {/* Session Status Breakdown */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Session Status Overview</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Ongoing</p>
                      <p className="font-bold text-blue-600">{dailyData.summary.ongoingSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pending Payment</p>
                      <p className="font-bold text-orange-600">{dailyData.summary.pendingPaymentSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Completed</p>
                      <p className="font-bold text-green-600">{dailyData.summary.completedSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Settlement (Udaro)</p>
                      <p className="font-bold text-purple-600">{dailyData.summary.udaroSessions || 0} sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credit & Settlement Summary */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Payment & Settlement Analysis</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Credit Sales Today</p>
                      <p className="font-bold text-slate-800">Rs. {Number(dailyData.summary.creditSales).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Credit Collected</p>
                      <p className="font-bold text-green-700">Rs. {Number(dailyData.summary.creditCollected).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Outstanding</p>
                      <p className={`font-bold ${dailyData.summary.outstanding > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        Rs. {Number(dailyData.summary.outstanding).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Regular Outstanding</p>
                      <p className="font-bold text-orange-600">Rs. {Number(dailyData.summary.regularOutstanding).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Udaro Outstanding</p>
                      <p className="font-bold text-purple-600">Rs. {Number(dailyData.summary.udaroOutstanding).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expenses Breakdown */}
              {dailyData.expensesByType && dailyData.expensesByType.length > 0 && (
                <Card className="border-slate-200 shadow-none">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm text-slate-700">Expenses by Type</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {dailyData.expensesByType.map((exp: any) => (
                        <div key={exp.expenseType}>
                          <p className="text-xs text-slate-500">{exp.expenseType}</p>
                          <p className="font-bold text-red-600">Rs. {Number(exp.total).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BreakdownTable 
                  title="By Rate" 
                  data={dailyData.byRate}
                  columns={[
                    { key: 'category', label: 'Rate/Percent', format: (v) => `Rs. ${v}` },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByRate',
                    (dailyData.byRate || []).map((r: any) => [r.ratePerPercent, r.sessions, r.revenue]),
                    ['Rate/Percent', 'Sessions', 'Revenue Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Charger" 
                  data={dailyData.byCharger}
                  columns={[
                    { key: 'category', label: 'Charger', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByCharger',
                    (dailyData.byCharger || []).map((c: any) => [c.chargerType, c.sessions, c.revenue]),
                    ['Charger', 'Sessions', 'Revenue Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Session Status" 
                  data={dailyData.byStatus}
                  columns={[
                    { key: 'category', label: 'Status', format: (v) => v.replace('_', ' ').toUpperCase() },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'outstanding', label: 'Outstanding Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'BySessionStatus',
                    (dailyData.byStatus || []).map((s: any) => [s.sessionStatus, s.sessions, s.outstanding]),
                    ['Status', 'Sessions', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Payment Method" 
                  data={dailyData.byPaymentMethod}
                  columns={[
                    { key: 'category', label: 'Method', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'collected', label: 'Collected Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByPaymentMethod',
                    (dailyData.byPaymentMethod || []).map((p: any) => [p.paymentMethod, p.sessions, p.collected]),
                    ['Method', 'Sessions', 'Collected Rs.'],
                    'excel'
                  )}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Monthly P&L */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <Button onClick={fetchMonthly} disabled={monthlyLoading} className="bg-blue-600 hover:bg-blue-700 h-9">
              {monthlyLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Generate
            </Button>
          </div>

          {monthlyLoading && <div className="flex items-center text-slate-400 py-8"><Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading...</div>}

          {monthlyData && !monthlyLoading && monthlyData.pnl && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Total Sessions" value={monthlyData.summary?.sessions || 0} />
                <SummaryCard label="Total Revenue" value={`Rs. ${Number(monthlyData.summary?.revenue || 0).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Total Collected" value={`Rs. ${Number(monthlyData.summary?.totalCollected || 0).toLocaleString()}`} color="text-blue-700" />
                <SummaryCard label="Net Profit" value={`Rs. ${Number(monthlyData.pnl.netProfit).toLocaleString()}`} color={monthlyData.pnl.netProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>

              {/* Session Status Overview */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Session Status Overview</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Ongoing</p>
                      <p className="font-bold text-blue-600">{monthlyData.summary?.ongoingSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pending Payment</p>
                      <p className="font-bold text-orange-600">{monthlyData.summary?.pendingPaymentSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Completed</p>
                      <p className="font-bold text-green-600">{monthlyData.summary?.completedSessions || 0} sessions</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Settlement (Udaro)</p>
                      <p className="font-bold text-purple-600">{monthlyData.summary?.udaroSessions || 0} sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* P&L Table */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Profit & Loss Statement — {monthlyData.month}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {[
                      { label: 'Charging Revenue', value: monthlyData.pnl.revenue, color: 'text-green-700', bold: true },
                      { label: 'Electricity Cost (NEA)', value: -monthlyData.pnl.electricityCost, color: 'text-orange-600' },
                      { label: 'Variable / Other Expenses', value: -monthlyData.pnl.variableExpenses, color: 'text-red-600' },
                      { label: 'Staff Cost', value: -monthlyData.pnl.staffCost, color: 'text-red-600' },
                      { label: 'Monthly Rent', value: -monthlyData.pnl.rent, color: 'text-red-600' },
                      { label: 'Other Fixed Cost', value: -monthlyData.pnl.otherFixed, color: 'text-red-600' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                        <span className={`text-sm ${row.bold ? 'font-semibold' : ''} text-slate-700`}>{row.label}</span>
                        <span className={`text-sm font-medium ${row.color}`}>
                          {row.value >= 0 ? '+' : ''}Rs. {Math.abs(row.value).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2 border-t-2 border-slate-300">
                      <span className="text-sm font-bold text-slate-800">Total Cost</span>
                      <span className="text-sm font-bold text-red-600">Rs. {Number(monthlyData.pnl.totalCost).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 bg-slate-50 rounded-lg px-3">
                      <span className="text-base font-bold text-slate-900">Net Profit</span>
                      <span className={`text-base font-bold ${monthlyData.pnl.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        Rs. {Number(monthlyData.pnl.netProfit).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment & Settlement Analysis */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Payment & Settlement Analysis</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Cash Revenue</p>
                      <p className="font-bold text-slate-800">Rs. {Number(monthlyData.paymentBreakdown.cash).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Bank/QR Revenue</p>
                      <p className="font-bold text-slate-800">Rs. {Number(monthlyData.paymentBreakdown.bankQr).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Credit Revenue</p>
                      <p className={`font-bold ${monthlyData.paymentBreakdown.credit > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
                        Rs. {Number(monthlyData.paymentBreakdown.credit).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Outstanding</p>
                      <p className="font-bold text-red-600">Rs. {Number(monthlyData.summary?.outstanding || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Regular Outstanding</p>
                      <p className="font-bold text-orange-600">Rs. {Number(monthlyData.summary?.regularOutstanding || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Udaro Outstanding</p>
                      <p className="font-bold text-purple-600">Rs. {Number(monthlyData.summary?.udaroOutstanding || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expenses Breakdown */}
              {monthlyData.expensesByType && monthlyData.expensesByType.length > 0 && (
                <Card className="border-slate-200 shadow-none">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm text-slate-700">Variable Expenses by Type</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {monthlyData.expensesByType.map((exp: any) => (
                        <div key={exp.expenseType}>
                          <p className="text-xs text-slate-500">{exp.expenseType}</p>
                          <p className="font-bold text-red-600">Rs. {Number(exp.total).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BreakdownTable 
                  title="By Rate" 
                  data={monthlyData.byRate}
                  columns={[
                    { key: 'category', label: 'Rate/Percent', format: (v) => `Rs. ${v}` },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByRate',
                    (monthlyData.byRate || []).map((r: any) => [r.ratePerPercent, r.sessions, r.revenue, r.collected, r.outstanding]),
                    ['Rate/Percent', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Charger" 
                  data={monthlyData.byCharger}
                  columns={[
                    { key: 'category', label: 'Charger', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByCharger',
                    (monthlyData.byCharger || []).map((c: any) => [c.chargerType, c.sessions, c.revenue, c.collected, c.outstanding]),
                    ['Charger', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Session Status" 
                  data={monthlyData.byStatus}
                  columns={[
                    { key: 'category', label: 'Status', format: (v) => v.replace('_', ' ').toUpperCase() },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'outstanding', label: 'Outstanding Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'BySessionStatus',
                    (monthlyData.byStatus || []).map((s: any) => [s.sessionStatus, s.sessions, s.outstanding]),
                    ['Status', 'Sessions', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Vehicle Report */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Start Date</Label>
              <Input type="date" value={vStart} onChange={(e) => setVStart(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">End Date</Label>
              <Input type="date" value={vEnd} onChange={(e) => setVEnd(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <Button onClick={fetchVehicles} disabled={vehiclesLoading} className="bg-blue-600 hover:bg-blue-700 h-9">
              {vehiclesLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Generate
            </Button>
          </div>

          {vehiclesLoading && <div className="flex items-center text-slate-400 py-8"><Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading...</div>}

          {vehiclesData && !vehiclesLoading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Unique Vehicles" value={vehiclesData.summary?.uniqueVehicles || 0} />
                <SummaryCard label="Total Sessions" value={vehiclesData.summary?.totalSessions || 0} />
                <SummaryCard label="Total Revenue" value={`Rs. ${Number(vehiclesData.summary?.totalRevenue || 0).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Avg Session Value" value={`Rs. ${Number(vehiclesData.summary?.avgSessionRevenue || 0).toLocaleString()}`} color="text-blue-700" />
              </div>

              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Visit Frequency Analysis</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(vehiclesData.visitFrequency || []).map((freq: any) => (
                      <div key={freq.frequency}>
                        <p className="text-xs text-slate-500">{freq.frequency}</p>
                        <p className="font-bold text-slate-800">{freq.vehicleCount} vehicles</p>
                        <p className="text-xs text-green-700">Rs. {Number(freq.totalRevenue).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <BreakdownTable 
                title="Top 20 Vehicles by Revenue" 
                data={vehiclesData.topVehicles}
                columns={[
                  { key: 'vehicleNo', label: 'Vehicle No', format: (v) => v },
                  { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                  { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  { key: 'collected', label: 'Collected Rs.', format: (v) => Number(v || 0).toLocaleString() },
                ]}
                onExport={() => exportSection(
                  'TopVehicles',
                  (vehiclesData.vehiclePerformance || []).map((v: any) => [
                    v.vehicleNo, v.totalSessions, v.totalRevenue, v.totalCollected, v.totalOutstanding, v.totalKwh, v.avgRevenue
                  ]),
                  ['Vehicle No', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.', 'Total kWh', 'Avg Revenue'],
                  'excel'
                )}
              />
            </>
          )}
        </div>
      )}

      {/* Settlement Report */}
      {activeTab === 'settlement' && (
        <div className="space-y-6">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Start Date</Label>
              <Input type="date" value={sStart} onChange={(e) => setSStart(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">End Date</Label>
              <Input type="date" value={sEnd} onChange={(e) => setSEnd(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <Button onClick={fetchSettlement} disabled={settlementLoading} className="bg-blue-600 hover:bg-blue-700 h-9">
              {settlementLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Generate
            </Button>
          </div>

          {settlementLoading && <div className="flex items-center text-slate-400 py-8"><Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading...</div>}

          {settlementData && !settlementLoading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Settlement Vehicles" value={settlementData.summary?.settlementVehicles || 0} />
                <SummaryCard label="Udaro Sessions" value={settlementData.summary?.totalUdaroSessions || 0} />
                <SummaryCard label="Total Revenue" value={`Rs. ${Number(settlementData.summary?.totalRevenue || 0).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Total Collected" value={`Rs. ${Number(settlementData.summary?.totalCollected || 0).toLocaleString()}`} color="text-blue-700" />
                <SummaryCard label="Total Outstanding" value={`Rs. ${Number(settlementData.summary?.totalOutstanding || 0).toLocaleString()}`} color="text-red-600" />
                <SummaryCard label="Overdue Sessions" value={settlementData.summary?.overdueSessions || 0} color="text-orange-600" />
                <SummaryCard label="Overdue Amount" value={`Rs. ${Number(settlementData.summary?.overdueAmount || 0).toLocaleString()}`} color="text-red-700" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BreakdownTable 
                  title="Payment Status" 
                  data={settlementData.paymentStatus}
                  columns={[
                    { key: 'category', label: 'Status', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'outstanding', label: 'Outstanding Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'PaymentStatus',
                    (settlementData.paymentStatus || []).map((p: any) => [p.paymentStatus, p.sessions, p.revenue, p.outstanding]),
                    ['Status', 'Sessions', 'Revenue Rs.', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="Overdue Analysis" 
                  data={settlementData.overdueAnalysis}
                  columns={[
                    { key: 'category', label: 'Status', format: (v) => v },
                    { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'outstanding', label: 'Outstanding Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'OverdueAnalysis',
                    (settlementData.overdueAnalysis || []).map((o: any) => [o.status, o.sessions, o.outstanding]),
                    ['Status', 'Sessions', 'Outstanding Rs.'],
                    'excel'
                  )}
                />
              </div>

              <BreakdownTable 
                title="Collection Efficiency (Bottom 20)" 
                data={settlementData.collectionEfficiency}
                columns={[
                  { key: 'vehicleNo', label: 'Vehicle No', format: (v) => v },
                  { key: 'sessions', label: 'Sessions', format: (v) => Number(v || 0).toLocaleString() },
                  { key: 'revenue', label: 'Revenue Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  { key: 'collected', label: 'Collected Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  { key: 'collectionRate', label: 'Rate %', format: (v) => `${Number(v || 0)}%` },
                ]}
                onExport={() => exportSection(
                  'CollectionEfficiency',
                  (settlementData.collectionEfficiency || []).map((c: any) => [
                    c.vehicleNo, c.sessions, c.revenue, c.collected, c.outstanding, c.collectionRate
                  ]),
                  ['Vehicle No', 'Sessions', 'Revenue Rs.', 'Collected Rs.', 'Outstanding Rs.', 'Collection Rate %'],
                  'excel'
                )}
              />
            </>
          )}
        </div>
      )}

      {/* Expense Report */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Start Date</Label>
              <Input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">End Date</Label>
              <Input type="date" value={eEnd} onChange={(e) => setEEnd(e.target.value)} className="h-9 w-44 border-slate-300" />
            </div>
            <Button onClick={fetchExpenses} disabled={expensesLoading} className="bg-blue-600 hover:bg-blue-700 h-9">
              {expensesLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Generate
            </Button>
          </div>

          {expensesLoading && <div className="flex items-center text-slate-400 py-8"><Loader2 className="animate-spin h-5 w-5 mr-2" /> Loading...</div>}

          {expensesData && !expensesLoading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SummaryCard label="Total Expenses" value={expensesData.summary?.totalExpenses || 0} />
                <SummaryCard label="Total Amount" value={`Rs. ${Number(expensesData.summary?.totalAmount || 0).toLocaleString()}`} color="text-red-600" />
                <SummaryCard label="Daily Average" value={`Rs. ${Number(expensesData.summary?.dailyAverage || 0).toLocaleString()}`} color="text-orange-600" />
                <SummaryCard label="Expense Types" value={expensesData.summary?.expenseTypes || 0} />
                <SummaryCard label="Avg Expense" value={`Rs. ${Number(expensesData.summary?.avgExpense || 0).toLocaleString()}`} color="text-slate-700" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BreakdownTable 
                  title="By Expense Type" 
                  data={expensesData.byType}
                  columns={[
                    { key: 'category', label: 'Type', format: (v) => v },
                    { key: 'count', label: 'Count', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'total', label: 'Total Rs.', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'average', label: 'Avg Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByExpenseType',
                    (expensesData.byType || []).map((e: any) => [e.expenseType, e.count, e.total, e.average, e.minimum, e.maximum]),
                    ['Type', 'Count', 'Total Rs.', 'Average Rs.', 'Min Rs.', 'Max Rs.'],
                    'excel'
                  )}
                />
                <BreakdownTable 
                  title="By Payment Method" 
                  data={expensesData.byPaymentMethod}
                  columns={[
                    { key: 'category', label: 'Method', format: (v) => v },
                    { key: 'count', label: 'Count', format: (v) => Number(v || 0).toLocaleString() },
                    { key: 'total', label: 'Total Rs.', format: (v) => Number(v || 0).toLocaleString() },
                  ]}
                  onExport={() => exportSection(
                    'ByPaymentMethod',
                    (expensesData.byPaymentMethod || []).map((p: any) => [p.paymentMethod, p.count, p.total]),
                    ['Method', 'Count', 'Total Rs.'],
                    'excel'
                  )}
                />
              </div>

              <BreakdownTable 
                title="Top 20 Expenses" 
                data={expensesData.topExpenses}
                columns={[
                  { key: 'date', label: 'Date', format: (v) => v },
                  { key: 'expenseType', label: 'Type', format: (v) => v },
                  { key: 'description', label: 'Description', format: (v) => v },
                  { key: 'amount', label: 'Amount Rs.', format: (v) => Number(v || 0).toLocaleString() },
                ]}
                onExport={() => exportSection(
                  'TopExpenses',
                  (expensesData.topExpenses || []).map((e: any) => [
                    e.date, e.expenseType, e.description, e.paymentMethod, e.amount, e.paidTo, e.voucherRef
                  ]),
                  ['Date', 'Type', 'Description', 'Payment Method', 'Amount Rs.', 'Paid To', 'Voucher Ref'],
                  'excel'
                )}
              />
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
