import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Calendar, Search, Filter, ChevronLeft, ChevronRight,
  Loader2, Car, Eye, XCircle, Clock, User, Phone,
  CheckCircle2, Ban, LogOut, Timer, Zap, TrendingUp,
  ChevronDown, ChevronUp, BarChart3,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────
type QueueStatus = 'WAITING' | 'CALLED' | 'ASSIGNED' | 'CANCELLED' | 'LEFT' | 'EXPIRED';

interface Vehicle {
  id: string;
  vehicleNo: string;
  companyBrand?: string;
  ownerName?: string;
  ownerContact?: string;
}

interface Staff {
  id: string;
  fullName: string;
  username: string;
}

interface QueueHistoryEntry {
  id: string;
  queuePosition: number;
  status: QueueStatus;
  priority: number;
  joinedAt: string;
  calledAt?: string;
  assignedAt?: string;
  cancelledAt?: string;
  assignedChargerId?: string;
  notes?: string;
  vehicle: Vehicle;
  creator: Staff;
  caller?: Staff;
  assigner?: Staff;
  canceller?: Staff;
}

// ─── Helpers ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<QueueStatus, { label: string; bg: string; text: string; icon: any }> = {
  WAITING:   { label: 'Waiting',   bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Timer },
  CALLED:    { label: 'Called',    bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Clock },
  ASSIGNED:  { label: 'Assigned',  bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
  LEFT:      { label: 'Left',      bg: 'bg-gray-100',   text: 'text-gray-700',   icon: LogOut },
  EXPIRED:   { label: 'Expired',   bg: 'bg-orange-100', text: 'text-orange-700', icon: Ban },
};

const CHART_COLORS = ['#10b981', '#ef4444', '#94a3b8', '#f59e0b', '#3b82f6', '#8b5cf6'];

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { date: dateStr, time: timeStr };
}

function calculateDuration(start: string, end?: string) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ─── Page ─────────────────────────────────────────────────────
export default function QueueHistoryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [history, setHistory] = useState<QueueHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // View details modal
  const [viewTarget, setViewTarget] = useState<QueueHistoryEntry | null>(null);

  // Analytics section toggle
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  function authH() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  // ── Fetch history ────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (statusFilter.length > 0) {
        params.append('status', statusFilter.join(','));
      }
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/queue/history?${params}`, { headers: authH() });
      if (res.status === 401) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setHistory(data.data?.history || []);
      setTotal(data.data?.total || 0);
      setTotalPages(data.data?.totalPages || 1);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load queue history', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, startDate, endDate, router, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Filter helpers ───────────────────────────────────────────
  const toggleStatus = (status: QueueStatus) => {
    setStatusFilter(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const applyFilters = () => {
    setPage(1);
    fetchHistory();
    setFilterOpen(false);
  };

  // ── Search filtering ─────────────────────────────────────────
  const filtered = history.filter(h =>
    !search ||
    h.vehicle.vehicleNo.toLowerCase().includes(search.toLowerCase()) ||
    (h.vehicle.ownerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (h.vehicle.companyBrand ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Stats ────────────────────────────────────────────────────
  const statsByStatus = {
    ASSIGNED: history.filter(h => h.status === 'ASSIGNED').length,
    CANCELLED: history.filter(h => h.status === 'CANCELLED').length,
    LEFT: history.filter(h => h.status === 'LEFT').length,
    EXPIRED: history.filter(h => h.status === 'EXPIRED').length,
  };

  // ── Analytics Calculations ───────────────────────────────────
  // Status distribution for pie chart
  const statusDistribution = Object.entries(statsByStatus).map(([status, count]) => ({
    name: status,
    value: count,
  })).filter(item => item.value > 0);

  // Average wait time by status
  const avgWaitByStatus = Object.keys(STATUS_CONFIG).map(status => {
    const entries = history.filter(h => h.status === status);
    if (entries.length === 0) return null;
    
    const totalMins = entries.reduce((sum, entry) => {
      const duration = calculateDuration(
        entry.joinedAt, 
        entry.assignedAt || entry.cancelledAt
      );
      // Convert duration string to minutes
      const match = duration.match(/(\d+)h\s*(\d+)m|(\d+)m|(\d+)h/);
      if (match) {
        if (match[1] && match[2]) return sum + (parseInt(match[1]) * 60 + parseInt(match[2]));
        if (match[3]) return sum + parseInt(match[3]);
        if (match[4]) return sum + parseInt(match[4]) * 60;
      }
      return sum;
    }, 0);
    
    return {
      status: STATUS_CONFIG[status as QueueStatus].label,
      avgWait: Math.round(totalMins / entries.length),
    };
  }).filter(item => item !== null);

  // Daily trend - group by date
  const dailyTrend = history.reduce((acc: any, entry) => {
    const date = new Date(entry.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!acc[date]) {
      acc[date] = { date, assigned: 0, cancelled: 0, left: 0, expired: 0 };
    }
    if (entry.status === 'ASSIGNED') acc[date].assigned++;
    if (entry.status === 'CANCELLED') acc[date].cancelled++;
    if (entry.status === 'LEFT') acc[date].left++;
    if (entry.status === 'EXPIRED') acc[date].expired++;
    return acc;
  }, {});
  const dailyTrendData = Object.values(dailyTrend).slice(-14); // Last 14 days

  // Success rate calculation
  const successRate = total > 0 ? ((statsByStatus.ASSIGNED / total) * 100).toFixed(1) : '0.0';
  const abandonmentRate = total > 0 ? (((statsByStatus.CANCELLED + statsByStatus.LEFT) / total) * 100).toFixed(1) : '0.0';

  // ─── Render ──────────────────────────────────────────────────
  return (
    <Layout activeTab="queue-history" title="Queue History">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Queue History</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            View past queue entries and their outcomes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setFilterOpen(!filterOpen)}
            variant="outline"
            className={cn(
              'border-slate-300',
              (statusFilter.length > 0 || startDate || endDate) && 'border-blue-500 text-blue-600'
            )}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {(statusFilter.length > 0 || startDate || endDate) && (
              <span className="ml-1.5 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {statusFilter.length + (startDate ? 1 : 0) + (endDate ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-5">
            <div className="space-y-4">
              {/* Status filters */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status as QueueStatus)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2',
                        statusFilter.includes(status as QueueStatus)
                          ? `${config.bg} ${config.text} border-current`
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700">
                  Apply Filters
                </Button>
                <Button onClick={clearFilters} variant="outline" className="border-slate-300">
                  Clear All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] text-slate-500">Total Entries</p>
            <p className="text-2xl font-bold text-slate-900">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] text-green-600 font-semibold">Assigned</p>
            <p className="text-2xl font-bold text-green-700">{statsByStatus.ASSIGNED}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] text-red-600 font-semibold">Cancelled</p>
            <p className="text-2xl font-bold text-red-700">{statsByStatus.CANCELLED}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] text-gray-600 font-semibold">Left</p>
            <p className="text-2xl font-bold text-gray-700">{statsByStatus.LEFT}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] text-orange-600 font-semibold">Expired</p>
            <p className="text-2xl font-bold text-orange-700">{statsByStatus.EXPIRED}</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Toggle Button */}
      {history.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-slate-900">Analytics & Insights</h3>
                <p className="text-xs text-slate-500">View charts and performance metrics</p>
              </div>
            </div>
            {analyticsOpen ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>
        </div>
      )}

      {/* Analytics Charts - Collapsible */}
      {history.length > 0 && analyticsOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 animate-in fade-in duration-300">
          {/* Status Distribution Pie Chart */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Status Distribution</CardTitle>
              <CardDescription>Queue outcome breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name} (${entry.value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-semibold">Success Rate</p>
                  <p className="text-xl font-bold text-green-700">{successRate}%</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 font-semibold">Abandonment</p>
                  <p className="text-xl font-bold text-red-700">{abandonmentRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Wait Time by Status */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Average Wait Time</CardTitle>
              <CardDescription>By final status (in minutes)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={avgWaitByStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis dataKey="status" type="category" stroke="#64748b" style={{ fontSize: '12px' }} width={80} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    formatter={(value: any) => `${value} min`}
                  />
                  <Bar dataKey="avgWait" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily Trend */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Daily Trend</CardTitle>
              <CardDescription>Last 14 days activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    style={{ fontSize: '10px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="assigned" stroke="#10b981" strokeWidth={2} name="Assigned" />
                  <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} name="Cancelled" />
                  <Line type="monotone" dataKey="left" stroke="#94a3b8" strokeWidth={2} name="Left" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by vehicle, owner…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 border-slate-300"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-500 hover:text-slate-800">
            Clear
          </button>
        )}
      </div>

      {/* History table */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Loading history…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Car className="h-8 w-8 opacity-40" />
          </div>
          <p className="font-semibold text-slate-600 text-lg">No history found</p>
          <p className="text-sm mt-1 text-slate-400">
            {search ? 'No entries match your search' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm mb-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Created At</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Vehicle No.</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Brand</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Charger</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((entry) => {
                    const config = STATUS_CONFIG[entry.status];
                    const Icon = config.icon;
                    const { date, time } = formatDateTime(entry.joinedAt);
                    const endTime = entry.assignedAt || entry.cancelledAt;
                    const duration = calculateDuration(entry.joinedAt, endTime);

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        {/* Position */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-200 text-slate-800 font-bold text-sm">
                            {entry.queuePosition}
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                          <div className="flex flex-col">
                            <span className="font-medium">{date}</span>
                            <span className="text-xs text-slate-500">{time}</span>
                          </div>
                        </td>

                        {/* Vehicle No */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{entry.vehicle.vehicleNo}</span>
                        </td>

                        {/* Brand */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                          {entry.vehicle.companyBrand || '—'}
                        </td>

                        {/* Owner */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                          {entry.vehicle.ownerName || '—'}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                            config.bg,
                            config.text
                          )}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-700">
                          {duration}
                        </td>

                        {/* Charger */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                          {entry.assignedChargerId ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                              <Zap className="h-3 w-3" />
                              {entry.assignedChargerId}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setViewTarget(entry)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page {page} of {totalPages} • {total} total entries
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ View Details Modal ══════════════════════════════════ */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-slate-800 text-white font-bold text-xl shadow-sm">
                  {viewTarget.queuePosition}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Queue History Details</h3>
                  <p className="text-xs text-slate-500">Position #{viewTarget.queuePosition}</p>
                </div>
              </div>
              <button
                onClick={() => setViewTarget(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Vehicle Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vehicle Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Vehicle Number</Label>
                    <p className="font-bold text-lg text-slate-900">{viewTarget.vehicle.vehicleNo}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Brand / Company</Label>
                    <p className="font-semibold text-slate-700">{viewTarget.vehicle.companyBrand || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Owner Name</Label>
                    <p className="font-semibold text-slate-700">{viewTarget.vehicle.ownerName || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Contact Number</Label>
                    <p className="font-semibold text-slate-700">{viewTarget.vehicle.ownerContact || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Status Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Status & Timeline</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Final Status</Label>
                    {(() => {
                      const config = STATUS_CONFIG[viewTarget.status];
                      const Icon = config.icon;
                      return (
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold',
                          config.bg,
                          config.text
                        )}>
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Total Duration</Label>
                    <p className="font-bold text-lg text-slate-700">
                      {calculateDuration(viewTarget.joinedAt, viewTarget.assignedAt || viewTarget.cancelledAt)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Joined Queue</Label>
                    <p className="font-semibold text-slate-700 text-sm">
                      {new Date(viewTarget.joinedAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })} at {new Date(viewTarget.joinedAt).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </p>
                  </div>
                  {viewTarget.calledAt && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Called At</Label>
                      <p className="font-semibold text-slate-700 text-sm">
                        {new Date(viewTarget.calledAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                  )}
                  {viewTarget.assignedAt && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Assigned At</Label>
                      <p className="font-semibold text-slate-700 text-sm">
                        {new Date(viewTarget.assignedAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                  )}
                  {viewTarget.cancelledAt && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Cancelled At</Label>
                      <p className="font-semibold text-slate-700 text-sm">
                        {new Date(viewTarget.cancelledAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Details */}
              {viewTarget.assignedChargerId && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Assignment Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-green-600">Assigned Charger</Label>
                      <p className="font-bold text-green-900 text-lg">{viewTarget.assignedChargerId}</p>
                    </div>
                    {viewTarget.assigner && (
                      <div className="space-y-1">
                        <Label className="text-xs text-green-600">Assigned By</Label>
                        <p className="font-semibold text-green-900">
                          {viewTarget.assigner.fullName || viewTarget.assigner.username}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Staff Information */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Staff Actions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Added By</Label>
                    <p className="font-semibold text-slate-700">
                      {viewTarget.creator?.fullName || viewTarget.creator?.username}
                    </p>
                  </div>
                  {viewTarget.caller && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Called By</Label>
                      <p className="font-semibold text-slate-700">
                        {viewTarget.caller.fullName || viewTarget.caller.username}
                      </p>
                    </div>
                  )}
                  {viewTarget.canceller && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Cancelled By</Label>
                      <p className="font-semibold text-red-700">
                        {viewTarget.canceller.fullName || viewTarget.canceller.username}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {viewTarget.notes ? (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700 italic">"{viewTarget.notes}"</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-400">No notes available for this entry</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              <Button
                onClick={() => setViewTarget(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-800"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
