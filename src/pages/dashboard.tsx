import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Zap, LayoutDashboard, Car, ListChecks,
  BarChart3, Receipt, Settings, Users,
  LogOut, TrendingUp, TrendingDown, CircleDollarSign,
  BatteryCharging, AlertCircle, Plus, ChevronRight, Loader2, Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  tenantId?: string;
}

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

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', tab: 'dashboard' },
  { label: 'Sessions', icon: ListChecks, path: '/sessions', tab: 'sessions' },
  { label: 'Vehicles', icon: Car, path: '/vehicles', tab: 'vehicles' },
  { label: 'Settlement', icon: Banknote, path: '/settlement', tab: 'settlement' },
  { label: 'Reports', icon: BarChart3, path: '/reports', tab: 'reports' },
  { label: 'Analytics', icon: TrendingUp, path: '/analytics', tab: 'analytics' },
  { label: 'Expenses', icon: Receipt, path: '/expenses', tab: 'expenses' },
  { label: 'Settings', icon: Settings, path: '/settings', tab: 'settings' },
];

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.replace('/');
      return;
    }
    const user = JSON.parse(userData);
    
    // Super admin should not access operational pages
    if (user.role === 'super_admin') {
      alert('Super Admin can only manage tenants. Redirecting...');
      router.replace('/tenants');
      return;
    }
    
    setUser(user);
    setLoading(false);

    // Fetch dashboard data
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/reports/dashboard', { headers })
      .then(r => r.json())
      .then(data => {
        setDashboardData(data);
      })
      .catch(err => console.error('Failed to load dashboard:', err))
      .finally(() => setDataLoading(false));
  }, [router]);

  const navigateTo = (path: string, tab: string) => {
    setActiveTab(tab);
    if (path !== '/dashboard') router.push(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/');
  };

  if (loading || !user) return null;

  const stats = dashboardData?.stats || {
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

  const allNavItems = user.role === 'super_admin'
    ? [...navItems, { label: 'Tenants', icon: Users, path: '/tenants', tab: 'tenants' }]
    : navItems;

  return (
    <>
      <Head>
        <title>Dashboard – Zylo EV Charging Station</title>
      </Head>

      <div className="min-h-screen bg-slate-50">

        {/* ── Top Navigation Bar ── */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center gap-4">

              {/* Logo */}
              <div className="flex items-center gap-2 mr-4 flex-shrink-0">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" fill="white" />
                </div>
                <span className="font-bold text-sm text-slate-900 hidden sm:block">
                  Zylo EV
                </span>
              </div>

              <Separator orientation="vertical" className="h-6 hidden sm:block" />

              {/* Nav Links */}
              <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
                {allNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => navigateTo(item.path, item.tab)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden md:block">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* User + Logout */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge variant="info" className="hidden sm:inline-flex capitalize">
                  {user.role.replace('_', ' ')}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:block ml-1.5">Logout</span>
                </Button>
              </div>

            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Dashboard</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Overview of Zylo EV Charging Station operations
              </p>
            </div>
            <Button
              onClick={() => navigateTo('/sessions/new', 'new-session')}
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

          {/* Loading State */}
          {dataLoading && (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-slate-600">Loading dashboard data...</span>
            </div>
          )}

          {/* KPI Grid */}
          {!dataLoading && (
            <>
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

              {/* Charts Row 1: Revenue Trend (Area) + Payment Methods (Pie) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Daily Revenue Trend - Area Chart */}
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
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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

                {/* Payment Methods - Pie Chart */}
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
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: Rs. ${entry.value.toFixed(0)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {(dashboardData?.byPayment || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => `Rs. ${parseFloat(value).toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 2: By Rate (Bar) + By Charger (Bar) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue by Rate - Bar Chart */}
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base">Revenue by Rate</CardTitle>
                    <CardDescription>Distribution across charging rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={dashboardData?.byRate || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="ratePerPercent" stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Rate (Rs/%)', position: 'insideBottom', offset: -5 }} />
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

                {/* Sessions by Charger - Bar Chart */}
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
                        <Tooltip 
                          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar dataKey="sessions" fill="#8b5cf6" name="Sessions" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="revenue" fill="#10b981" name="Revenue (Rs)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Chart Row 3: Hourly Distribution - Line Chart */}
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
                        dataKey="hour" 
                        stroke="#64748b" 
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                        tickFormatter={(hour) => `${hour}:00`}
                      />
                      <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                      <Tooltip 
                        contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                        labelFormatter={(hour) => `${hour}:00`}
                        formatter={(value: any, name: string) => [
                          name === 'sessions' ? value : `Rs. ${parseFloat(value).toFixed(2)}`,
                          name === 'sessions' ? 'Sessions' : 'Revenue'
                        ]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="sessions" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} name="Sessions" />
                      <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4' }} name="Revenue (Rs)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Activity Summary */}
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Recent Activity</CardTitle>
                      <CardDescription>Latest charging sessions</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateTo('/sessions', 'sessions')}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      View All
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!dashboardData?.recentSessions || dashboardData.recentSessions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">No recent sessions</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboardData.recentSessions.map((session: any) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* Vehicle Info */}
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

                            {/* Session Details */}
                            <div className="hidden sm:flex items-center gap-4 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                <span className="text-xs font-medium text-slate-600">
                                  {parseFloat(session.chargedPercent).toFixed(0)}%
                                </span>
                              </div>
                              <Badge 
                                variant={session.chargerType === 'GBT' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {session.chargerType}
                              </Badge>
                              <Badge 
                                variant={
                                  session.paymentStatus === 'Paid' ? 'success' : 
                                  session.paymentStatus === 'Pending' ? 'warning' : 
                                  'default'
                                }
                                className="text-xs"
                              >
                                {session.paymentMethod}
                              </Badge>
                            </div>

                            {/* Amount */}
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
            </>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              onClick={() => navigateTo('/sessions/new', 'new-session')}
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
              onClick={() => navigateTo('/analytics', 'analytics')}
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
              onClick={() => navigateTo('/reports', 'reports')}
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

        </main>
      </div>
    </>
  );
}
