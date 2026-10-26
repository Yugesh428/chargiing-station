import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'period' | 'daily' | 'monthly';

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

function BreakdownTable({ title, data }: { title: string; data: Record<string, any> | null | undefined }) {
  if (!data) return null;
  const rows = Object.entries(data);
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Category</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Sessions</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Revenue Rs.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([key, val]) => (
              <tr key={key}>
                <td className="px-3 py-2 text-slate-700 font-medium">{key}</td>
                <td className="px-3 py-2 text-right text-slate-600">{val.sessions}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">
                  {Number(val.revenue).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('period');

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

  useEffect(() => {
    if (activeTab === 'period') fetchPeriod();
    else if (activeTab === 'daily') fetchDaily();
    else fetchMonthly();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'period', label: 'Period Report' },
    { id: 'daily', label: 'Daily Closing' },
    { id: 'monthly', label: 'Monthly P&L' },
  ];

  return (
    <Layout activeTab="reports" title="Reports">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-500 mt-0.5">Financial reports and analytics</p>
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
                <SummaryCard label="Revenue" value={`Rs. ${(Number(periodData.summary?.totalRevenue) || 0).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Electricity Cost" value={`Rs. ${(Number(periodData.summary?.totalElectricityCost) || 0).toLocaleString()}`} color="text-orange-600" />
                <SummaryCard label="Net Contribution" value={`Rs. ${(Number(periodData.summary?.totalNetContribution) || 0).toLocaleString()}`} color={(periodData.summary?.totalNetContribution || 0) >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <BreakdownTable title="By Rate" data={periodData.byRate} />
                <BreakdownTable title="By Charger Type" data={periodData.byCharger} />
                <BreakdownTable title="By Payment Method" data={periodData.byMethod} />
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
                <SummaryCard label="Revenue" value={`Rs. ${Number(dailyData.summary.revenue).toLocaleString()}`} color="text-green-700" />
                <SummaryCard label="Cash" value={`Rs. ${Number(dailyData.summary.cashCollected).toLocaleString()}`} />
                <SummaryCard label="Bank/QR" value={`Rs. ${Number(dailyData.summary.bankCollected).toLocaleString()}`} />
                <SummaryCard label="Outstanding" value={`Rs. ${Number(dailyData.summary.outstanding).toLocaleString()}`} color={dailyData.summary.outstanding > 0 ? 'text-red-600' : ''} />
                <SummaryCard label="Electricity Cost" value={`Rs. ${Number(dailyData.summary.electricityCost).toLocaleString()}`} color="text-orange-600" />
                <SummaryCard label="Other Expenses" value={`Rs. ${Number(dailyData.summary.totalExpenses).toLocaleString()}`} />
                <SummaryCard label="Net Profit" value={`Rs. ${Number(dailyData.summary.netProfit).toLocaleString()}`} color={dailyData.summary.netProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>

              {/* Credit section */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Credit Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-3">
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
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BreakdownTable title="By Rate" data={dailyData.byRate} />
                <BreakdownTable title="By Charger" data={dailyData.byCharger} />
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

          {monthlyData && !monthlyLoading && (
            <>
              {/* P&L Table */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Profit & Loss — {monthlyData.month}</CardTitle>
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

              {/* Payment breakdown */}
              <Card className="border-slate-200 shadow-none">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm text-slate-700">Payment Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Cash</p>
                      <p className="font-bold text-slate-800">Rs. {Number(monthlyData.paymentBreakdown.cash).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Bank/QR</p>
                      <p className="font-bold text-slate-800">Rs. {Number(monthlyData.paymentBreakdown.bankQr).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Credit</p>
                      <p className={`font-bold ${monthlyData.paymentBreakdown.credit > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
                        Rs. {Number(monthlyData.paymentBreakdown.credit).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BreakdownTable title="By Rate" data={monthlyData.byRate} />
                <BreakdownTable title="By Charger" data={monthlyData.byCharger} />
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
