import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Calendar, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ComposedChart,
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444'];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/analytics?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(err => console.error('Failed to load analytics:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApply = () => {
    fetchData();
  };

  // ── Export Functions ──────────────────────────────────────────────────────
  const exportAnalytics = async (format: 'csv' | 'excel') => {
    setExporting(format);
    try {
      if (!data) {
        toast({ title: 'No data', description: 'Load analytics first before exporting.', variant: 'destructive' });
        return;
      }

      const filename = `Analytics_${dateRange.startDate}_to_${dateRange.endDate}`;

      // Build comprehensive export data
      const sections: any[] = [
        ['ANALYTICS SUMMARY'],
        ['Metric', 'Value'],
        ['Total Sessions', data.summary?.totalSessions || 0],
        ['Total Revenue', `Rs. ${parseFloat(data.summary?.totalRevenue || 0).toLocaleString()}`],
        ['Average Session Value', `Rs. ${parseFloat(data.summary?.avgSessionValue || 0).toFixed(2)}`],
        ['Profit Margin', `${parseFloat(data.summary?.profitMargin || 0).toFixed(1)}%`],
        [],
        ['TOP 10 VEHICLES'],
        ['Rank', 'Vehicle No', 'Visits', 'Revenue (Rs)'],
        ...(data.topVehicles || []).map((v: any, i: number) => [i + 1, v.vehicleNo, v.visits, v.revenue]),
        [],
        ['CUSTOMER SEGMENTS'],
        ['Segment', 'Count'],
        ...(data.customerSegments || []).map((s: any) => [s.name, s.count]),
        [],
        ['PAYMENT ANALYSIS'],
        ['Method', 'Paid (Rs)', 'Pending (Rs)', 'Partial (Rs)'],
        ...(data.paymentAnalysis || []).map((p: any) => [p.method, p.paid, p.pending, p.partial]),
      ];

      if (format === 'csv') {
        const escape = (v: any) => {
          if (v === null || v === undefined) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = sections.map(r => Array.isArray(r) ? r.map(escape).join(',') : '').join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'CSV exported', description: `${filename}.csv` });
      } else {
        const XLSX = (await import('xlsx')).default || await import('xlsx');
        const ws = XLSX.utils.aoa_to_sheet(sections);
        ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
        XLSX.writeFile(wb, `${filename}.xlsx`);
        toast({ title: 'Excel exported', description: `${filename}.xlsx` });
      }
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <Layout activeTab="analytics" title="Analytics">
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading analytics...</span>
      </div>
    </Layout>
  );

  return (
    <Layout activeTab="analytics" title="Analytics">
      <Toaster />
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Advanced Analytics</h2>
            <p className="text-sm text-slate-500 mt-0.5">Comprehensive insights and visualizations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => exportAnalytics('csv')}
              disabled={exporting === 'csv'}
            >
              {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => exportAnalytics('excel')}
              disabled={exporting === 'excel'}
            >
              {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card className="border-slate-200 bg-white mb-6">
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">Start Date</Label>
              <Input 
                type="date" 
                value={dateRange.startDate}
                onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">End Date</Label>
              <Input 
                type="date" 
                value={dateRange.endDate}
                onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="h-9"
              />
            </div>
            <Button onClick={handleApply} className="bg-blue-600 hover:bg-blue-700 h-9">
              <Calendar className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{data?.summary?.totalSessions || 0}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">+{data?.summary?.sessionGrowth || 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">
              Rs. {parseFloat(data?.summary?.totalRevenue || 0).toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">+{data?.summary?.revenueGrowth || 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Avg Session Value</p>
            <p className="text-2xl font-bold text-blue-600">
              Rs. {parseFloat(data?.summary?.avgSessionValue || 0).toFixed(0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Per charging session</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Profit Margin</p>
            <p className="text-2xl font-bold text-purple-600">
              {parseFloat(data?.summary?.profitMargin || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Net profit ratio</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Revenue Trend (Composed) + Customer Segmentation (Pie) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Multi-metric Trend - Composed Chart */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Revenue & Performance Trends</CardTitle>
            <CardDescription>Multi-metric daily analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data?.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value: any) => `${typeof value === 'number' ? (value < 100 ? value : 'Rs. ' + value.toFixed(0)) : value}`}
                />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="revenue" fill="#3b82f680" stroke="#3b82f6" name="Revenue (Rs)" />
                <Bar yAxisId="left" dataKey="profit" fill="#10b981" name="Profit (Rs)" />
                <Line yAxisId="right" type="monotone" dataKey="sessions" stroke="#f59e0b" strokeWidth={2} name="Sessions" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customer Segmentation - Pie Chart */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Customer Segments</CardTitle>
            <CardDescription>By visit frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.customerSegments || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name} (${entry.count})`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(data?.customerSegments || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {(data?.customerSegments || []).map((seg: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                    <span className="text-slate-600">{seg.name}</span>
                  </div>
                  <span className="font-semibold">{seg.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Hourly Heatmap (Bar) + Payment Analysis (Stacked Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Peak Hours Analysis */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Peak Hours Heatmap</CardTitle>
            <CardDescription>Session distribution by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.hourlyDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#64748b" 
                  style={{ fontSize: '12px' }}
                  tickFormatter={(hour) => `${hour}h`}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  labelFormatter={(hour) => `${hour}:00`}
                />
                <Bar dataKey="sessions" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Status Distribution */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Payment Analysis</CardTitle>
            <CardDescription>By method and status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.paymentAnalysis || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis dataKey="method" type="category" stroke="#64748b" style={{ fontSize: '12px' }} width={80} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value: any) => `Rs. ${parseFloat(value).toFixed(0)}`}
                />
                <Legend />
                <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid" />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                <Bar dataKey="partial" stackId="a" fill="#ef4444" name="Partial" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Vehicle Performance (Radar) + Rate Comparison (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Charger Performance Radar */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Charger Performance Metrics</CardTitle>
            <CardDescription>Multi-dimensional comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={data?.chargerPerformance || []}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" style={{ fontSize: '12px' }} />
                <PolarRadiusAxis style={{ fontSize: '10px' }} />
                <Radar name="GBT" dataKey="GBT" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Radar name="CCS2" dataKey="CCS2" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rate Performance */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Rate Performance Analysis</CardTitle>
            <CardDescription>Revenue and sessions by rate</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data?.ratePerformance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="rate" stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Rate (Rs/%)', position: 'insideBottom', offset: -5 }} />
                <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#10b981" name="Revenue (Rs)" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="sessions" fill="#3b82f6" name="Sessions" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Top Vehicles + Daily Pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Top Performing Vehicles */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Top 10 Vehicles</CardTitle>
            <CardDescription>By revenue generated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.topVehicles || []).map((vehicle: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-700' :
                      idx === 1 ? 'bg-slate-300/20 text-slate-700' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{vehicle.vehicleNo}</p>
                      <p className="text-xs text-slate-500">{vehicle.visits} visits</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      Rs. {parseFloat(vehicle.revenue).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Pattern */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Weekly Pattern Analysis</CardTitle>
            <CardDescription>Day-of-week performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.weeklyPattern || []}>
                <defs>
                  <linearGradient id="colorWeekRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value: any, name: string) => [
                    name === 'sessions' ? value : `Rs. ${parseFloat(value).toFixed(0)}`,
                    name === 'sessions' ? 'Sessions' : 'Revenue'
                  ]}
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorWeekRevenue)" name="Revenue (Rs)" />
                <Line type="monotone" dataKey="sessions" stroke="#f59e0b" strokeWidth={2} name="Sessions" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Key Insights Summary */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Key Insights & Recommendations</CardTitle>
          <CardDescription>AI-powered business intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.insights || []).map((insight: any, idx: number) => (
              <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                insight.type === 'success' ? 'bg-green-50 border-green-500' :
                insight.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                insight.type === 'info' ? 'bg-blue-50 border-blue-500' :
                'bg-slate-50 border-slate-500'
              }`}>
                <div className="flex items-start gap-3">
                  {insight.type === 'success' && <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'warning' && <TrendingDown className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-1">{insight.title}</p>
                    <p className="text-xs text-slate-600">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
