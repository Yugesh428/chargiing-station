import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Zap, LayoutDashboard, Car, ListChecks, BarChart3,
  Receipt, Settings, Users, LogOut, Plus, TrendingUp, Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  tenantId?: string;
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  title?: string;
}

const navItems = [
  { label: 'Dashboard',   icon: LayoutDashboard, path: '/dashboard',   tab: 'dashboard'   },
  { label: 'Sessions',    icon: ListChecks,       path: '/sessions',    tab: 'sessions'    },
  { label: 'Vehicles',    icon: Car,              path: '/vehicles',    tab: 'vehicles'    },
  { label: 'Settlement',  icon: Banknote,         path: '/settlement',  tab: 'settlement'  },
  { label: 'Reports',     icon: BarChart3,        path: '/reports',     tab: 'reports'     },
  { label: 'Analytics',   icon: TrendingUp,       path: '/analytics',   tab: 'analytics'   },
  { label: 'Expenses',    icon: Receipt,          path: '/expenses',    tab: 'expenses'    },
  { label: 'Settings',    icon: Settings,         path: '/settings',    tab: 'settings'    },
];

export default function Layout({ children, activeTab, title }: LayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.replace('/');
      return;
    }
    const u = JSON.parse(userData);
    
    // Super admin can only access tenants page
    if (u.role === 'super_admin' && activeTab !== 'tenants') {
      router.replace('/tenants');
      return;
    }
    
    setUser(u);
  }, [router, activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/');
  };

  if (!user) return null;

  const allNavItems = user.role === 'super_admin'
    ? [...navItems, { label: 'Tenants', icon: Users, path: '/tenants', tab: 'tenants' }]
    : navItems;

  return (
    <>
      <Head>
        <title>{title ? `${title} – Zylo EV` : 'Zylo EV Charging Station'}</title>
      </Head>

      <div className="min-h-screen bg-slate-50">
        {/* Top Nav */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center gap-3">
              {/* Logo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" fill="white" />
                </div>
                <span className="font-bold text-sm text-slate-900 hidden sm:block">Zylo EV</span>
              </div>

              <Separator orientation="vertical" className="h-6 hidden sm:block" />

              {/* Nav */}
              <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
                {allNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => router.push(item.path)}
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

              {/* User */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge variant="info" className="hidden sm:inline-flex capitalize text-xs">
                  {user.role === 'tenant_admin' ? 'Tenant Admin' : user.role === 'super_admin' ? 'Super Admin' : 'Operator'}
                </Badge>
                <Button
                  variant="ghost" size="sm"
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

        {/* Page Content */}
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </>
  );
}
