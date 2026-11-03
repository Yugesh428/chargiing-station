import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Zap, Car, TrendingUp, TrendingDown, CircleDollarSign,
  BatteryCharging, AlertCircle, Plus, ChevronRight, Loader2, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Layout from '@/components/Layout';

interface DashboardStats {
  totalSessions: number;
  uniqueVehicles: number;
  repeatVisits: number;
  totalCharged: number;
  totalRevenue: number;
  electricityCost: number;
  otherExpenses: number;
  netProfit: number;
  pendingAmount: number;
}

interface DashboardData {
  stats: DashboardStats;
  byRate: any[];
  byCharger: any[];
  byPayment: any[];
  dailyTrend: any[];
  hourlyDistribution: any[];
  recentSessions: any[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'];

const kpiCards = (stats: DashboardStats) => [
  {
    title: 'Total Sessions',
    value: stats.totalSessions.toString(),
    icon: BatteryCharging,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    description: 'All charging sessions',
  },
  {
    title: 'Unique Vehicles',
    value: stats.uniqueVehicles.toString(),
    icon: Car,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    description: 'Distinct vehicles served',
  },
  {
    title: 'Repeat Visits',
    value: stats.repeatVisits.toString(),
    icon: TrendingUp,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    description: 'Returning vehicle visits',
  },
  {
    title: 'Total Charged',
    value: `${parseFloat(String(stats.totalCharged || 0)).toFixed(0)}%`,
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    description: 'Total SOC % charged',
  },
  {
    title: 'Total Revenue',
    value: `Rs. ${stats.totalRevenue.toLocaleString()}`,
    icon: CircleDollarSign,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    description: 'Gross charging revenue',
  },
  {
    title: 'Electricity Cost',
    value: `Rs. ${stats.electricityCost.toLocaleString()}`,
    icon: Zap,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    description: 'NEA electricity cost',
  },
  {
    title: 'Other Expenses',
    value: `Rs. ${stats.otherExpenses.toLocaleString()}`,
    icon: Receipt,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    description: 'Staff, rent, others',
  },
  {
    title: 'Net Profit',
    value: `Rs. ${stats.netProfit.toLocaleString()}`,
    icon: stats.netProfit >= 0 ? TrendingUp : TrendingDown,
    color: stats.netProfit >= 0 ? 'text-green-500' : 'text-red-500',
    bg: stats.netProfit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
    description: 'Revenue minus all costs',
  },
];

export default function Dashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/reports/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setDashboardData(data))
      .catch(err => console.error('Failed to load dashboard:', err))
      .finally(() => setDataLoading(false));
  }, []);

  const stats: DashboardStats = dashboardData?.stats ?? {
    totalSessions: 0,
    uniqueVehicles: 0,
    repeatVisits: 0,
    totalCharged: 0,
    totalRevenue: 0,
    electricityCost: 0,
    otherExpenses: 0,
    netProfit: 0,
    pendingAmount: 0,
  };

  return (
    <Layout activeTab="dashboard" title="Dashboard">

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Overview of Zylo EV Charging Station operations
          </p>
        </div>
        <Button
          onClick={() => router.push('/sessions/new')}
          className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Session
        </Button>
      </div>

      {/* Pending Alert */}
      {stats.pendingAmount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 mb-6">
          <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Pending Amount:</span>{' '}
            Rs. {parseFloat(String(stats.pendingAmount)).toLocaleString()} outstanding — credit sessions not yet collected.
          </p>
        </div>
      )}

      {/* Loading */}
      {dataLoading && (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-slate-600">Loading dashboard data...</span>
        </div>
      )}

      {/* Content */}
      {!dataLoading && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpiCards(stats).map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-slate-200 bg-white shadow-none hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-slate-500">{card.title}</p>
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', card.bg)}>
                        <Icon className={cn('h-4 w-4', card.color)} />
                      </div>
                    </div>
                    <p className={cn(
                      'text-xl font-bold',
                      card.color === 'text-green-500' || card.color === 'text-red-500'
                        ? card.color
                        : 'text-slate-900'
                    )}>
                      {card.value}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{card.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Revenue & Profit Trend</CardTitle>
                <CardDescription>Last 7 days performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dashboardData?.dailyTrend || []}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value: any) => `Rs. ${parseFloat(value).toFixed(2)}`}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name="Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Payment Methods</CardTitle>
                <CardDescription>Revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={(dashboardData?.byPayment || []).map((item: any) => ({
                        name: item.paymentMethod,
                        value: parseFloat(item.total || 0),
                      }))}
                      cx="50%" cy="50%" labelLine={false}
                      label={(entry) => `${entry.name}: Rs. ${entry.value.toFixed(0)}`}
                      outerRadius={80} dataKey="value"
                    >
                      {(dashboardData?.byPayment || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `Rs. ${parseFloat(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Revenue by Rate</CardTitle>
                <CardDescription>Distribution across charging rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dashboardData?.byRate || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="ratePerPercent" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      formatter={(value: any) => `Rs. ${parseFloat(value).toFixed(2)}`}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Sessions by Charger Type</CardTitle>
                <CardDescription>Usage distribution by charger</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dashboardData?.byCharger || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="chargerType" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="sessions" fill="#8b5cf6" name="Sessions" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (Rs)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Distribution */}
          <Card className="border-slate-200 mb-6">
            <CardHeader>
              <CardTitle className="text-base">Hourly Session Distribution</CardTitle>
              <CardDescription>Peak hours analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dashboardData?.hourlyDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="hour" stroke="#64748b" style={{ fontSize: '12px' }}
                    tickFormatter={(h) => `${h}:00`}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    labelFormatter={(h: any) => `${h}:00`}
                    formatter={(value: any, name: any) => [
                      name === 'sessions' ? value : `Rs. ${parseFloat(value).toFixed(2)}`,
                      name === 'sessions' ? 'Sessions' : 'Revenue',
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} name="Sessions" />
                  <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4' }} name="Revenue (Rs)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                  <CardDescription>Latest charging sessions</CardDescription>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => router.push('/sessions')}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!dashboardData?.recentSessions?.length ? (
                <p className="text-sm text-slate-400 text-center py-8">No recent sessions</p>
              ) : (
                <div className="space-y-3">
                  {dashboardData.recentSessions.map((session: any) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <Car className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{session.vehicleNo}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {session.time && ` • ${session.time}`}
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-yellow-500" />
                            <span className="text-xs font-medium text-slate-600">
                              {parseFloat(session.chargedPercent || 0).toFixed(0)}%
                            </span>
                          </div>
                          <Badge variant={session.chargerType === 'GBT' ? 'default' : 'secondary'} className="text-xs">
                            {session.chargerType}
                          </Badge>
                          <Badge
                            variant={session.paymentStatus === 'Paid' ? 'success' : session.paymentStatus === 'Pending' ? 'warning' : 'default'}
                            className="text-xs"
                          >
                            {session.paymentMethod}
                          </Badge>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">
                            Rs. {parseFloat(session.chargeAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                          {session.operator && (
                            <p className="text-xs text-slate-400">by {session.operator}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <Card
              onClick={() => router.push('/sessions/new')}
              className="cursor-pointer border-blue-200 bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-600/20 transition-all"
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">⚡ New Charging Session</p>
                  <p className="text-xs text-blue-200 mt-0.5">One-click session entry</p>
                </div>
                <ChevronRight className="h-5 w-5 text-blue-300" />
              </CardContent>
            </Card>

            <Card
              onClick={() => router.push('/analytics')}
              className="cursor-pointer border-purple-200 bg-gradient-to-br from-purple-600 to-purple-700 text-white hover:shadow-lg hover:shadow-purple-600/20 transition-all"
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">📊 Advanced Analytics</p>
                  <p className="text-xs text-purple-200 mt-0.5">Deep insights & charts</p>
                </div>
                <ChevronRight className="h-5 w-5 text-purple-300" />
              </CardContent>
            </Card>

            <Card
              onClick={() => router.push('/reports')}
              className="cursor-pointer bg-white hover:shadow-md transition-shadow border-slate-200"
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-800">📈 Reports</p>
                  <p className="text-xs text-slate-500 mt-0.5">Daily, monthly & period</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </Layout>
  );
}
