import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Zap, LayoutDashboard, Car, ListChecks, BarChart3,
  Receipt, Settings, Users, LogOut, TrendingUp, Banknote,
  Menu, X, ChevronDown, ChevronRight,
  ClipboardList, Gauge, Tag, Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

// ─── Nav tree definition ─────────────────────────────────────
// type: 'item'  = direct link
// type: 'group' = collapsible parent with children
type NavItem =
  | { type: 'item';  label: string; icon: any; path: string; tab: string }
  | { type: 'group'; label: string; icon: any; key: string; children: NavLeaf[] };

type NavLeaf = { label: string; icon: any; path: string; tab: string };

const navTree: NavItem[] = [
  { type: 'item',  label: 'Dashboard',  icon: LayoutDashboard, path: '/dashboard',  tab: 'dashboard'  },
  { type: 'item',  label: 'Sessions',   icon: ListChecks,      path: '/sessions',   tab: 'sessions'   },
  { type: 'item',  label: 'Vehicles',   icon: Car,             path: '/vehicles',   tab: 'vehicles'   },

  // ── Charger Management group ──
  {
    type: 'group', label: 'Chargers', icon: Gauge, key: 'chargers',
    children: [
      { label: 'Charger Categories', icon: Tag,    path: '/chargers/categories', tab: 'charger-categories' },
      { label: 'Chargers',           icon: Layers, path: '/chargers',            tab: 'chargers'            },
    ],
  },

  // ── Queue Management group ──
  {
    type: 'group', label: 'Queue', icon: ClipboardList, key: 'queue',
    children: [
      { label: 'Active Queue',  icon: ClipboardList, path: '/queue',         tab: 'queue'         },
      { label: 'Queue History', icon: BarChart3,      path: '/queue/history', tab: 'queue-history' },
    ],
  },

  { type: 'item',  label: 'Settlement', icon: Banknote,   path: '/settlement', tab: 'settlement' },
  { type: 'item',  label: 'Reports',    icon: BarChart3,  path: '/reports',    tab: 'reports'    },
  { type: 'item',  label: 'Analytics',  icon: TrendingUp, path: '/analytics',  tab: 'analytics'  },
  { type: 'item',  label: 'Expenses',   icon: Receipt,    path: '/expenses',   tab: 'expenses'   },
  { type: 'item',  label: 'Settings',   icon: Settings,   path: '/settings',   tab: 'settings'   },
];

const superAdminExtra: NavItem = {
  type: 'item', label: 'Tenants', icon: Users, path: '/tenants', tab: 'tenants',
};

// Helper: which group key contains this tab?
function parentGroupOf(tab: string): string | null {
  for (const item of navTree) {
    if (item.type === 'group') {
      if (item.children.some(c => c.tab === tab)) return item.key;
    }
  }
  return null;
}

// ─── Layout ──────────────────────────────────────────────────
export default function Layout({ children, activeTab, title }: LayoutProps) {
  const router = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);   // desktop icon-only
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer

  // Which group keys are open (expanded)?  Auto-open the group containing active tab.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const parent = parentGroupOf(activeTab);
    return parent ? new Set([parent]) : new Set();
  });

  useEffect(() => {
    const token    = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { router.replace('/'); return; }
    const u = JSON.parse(userData);
    if (u.role === 'super_admin' && activeTab !== 'tenants') { router.replace('/tenants'); return; }
    setUser(u);
  }, [router, activeTab]);

  // Auto-expand parent group when active tab changes
  useEffect(() => {
    const parent = parentGroupOf(activeTab);
    if (parent) setOpenGroups(prev => new Set([...prev, parent]));
  }, [activeTab]);

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [router.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/');
  };

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!user) return null;

  const allNav: NavItem[] =
    user.role === 'super_admin' ? [...navTree, superAdminExtra] : navTree;

  const roleLabel =
    user.role === 'tenant_admin' ? 'Tenant Admin'
    : user.role === 'super_admin' ? 'Super Admin'
    : 'Operator';

  // ─── Sidebar inner content (shared desktop + mobile) ───────
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    const isExpanded = mobile || !collapsed;

    return (
      <div className="flex flex-col h-full select-none">

        {/* ── Logo row ── */}
        <div className={cn(
          'flex items-center h-14 px-3 flex-shrink-0 border-b border-slate-100',
          isExpanded ? 'justify-between' : 'justify-center',
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </div>
            {isExpanded && (
              <div className="min-w-0 leading-tight">
                <p className="font-bold text-sm text-slate-900">Zylo EV</p>
                <p className="text-[10px] text-slate-400 truncate">Charging Management</p>
              </div>
            )}
          </div>

          {/* Close on mobile / hamburger toggle on desktop */}
          {mobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Nav tree ── */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-0.5 px-2">
            {allNav.map((item, idx) => {

              // ── Flat item ──
              if (item.type === 'item') {
                const Icon     = item.icon;
                const isActive = activeTab === item.tab;
                return (
                  <li key={item.tab}>
                    <button
                      onClick={() => router.push(item.path)}
                      title={!isExpanded ? item.label : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all',
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        !isExpanded && 'justify-center px-2',
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {isExpanded && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              }

              // ── Group item ──
              const GroupIcon  = item.icon;
              const isOpen     = openGroups.has(item.key);
              const groupActive = item.children.some(c => c.tab === activeTab);

              return (
                <li key={item.key}>
                  {/* Group header */}
                  <button
                    onClick={() => {
                      if (!isExpanded) {
                        // When collapsed, expand sidebar first then open group
                        setCollapsed(false);
                        setOpenGroups(prev => new Set([...prev, item.key]));
                      } else {
                        toggleGroup(item.key);
                      }
                    }}
                    title={!isExpanded ? item.label : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all',
                      groupActive
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      !isExpanded && 'justify-center px-2',
                    )}
                  >
                    <GroupIcon className="h-4 w-4 flex-shrink-0" />
                    {isExpanded && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {isOpen
                          ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        }
                      </>
                    )}
                  </button>

                  {/* Children — only visible when expanded AND group is open */}
                  {isExpanded && isOpen && (
                    <ul className="mt-0.5 ml-3 pl-3 border-l border-slate-200 space-y-0.5">
                      {item.children.map(child => {
                        const ChildIcon = child.icon;
                        const isActive  = activeTab === child.tab;
                        return (
                          <li key={child.tab}>
                            <button
                              onClick={() => router.push(child.path)}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all',
                                isActive
                                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                              )}
                            >
                              <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── User / Logout ── */}
        <div className={cn(
          'border-t border-slate-100 p-3 flex-shrink-0',
          !isExpanded ? 'flex flex-col items-center gap-2' : 'space-y-2',
        )}>
          {isExpanded && (
            <div className="px-1 pb-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.fullName}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          )}
          <div className={cn(
            'flex gap-2',
            !isExpanded ? 'flex-col items-center' : 'items-center justify-between px-1',
          )}>
            {isExpanded && (
              <Badge className="text-[10px] capitalize bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                {roleLabel}
              </Badge>
            )}
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {isExpanded && <span>Logout</span>}
            </button>
          </div>
        </div>

      </div>
    );
  };

  // ─── Root render ────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>{title ? `${title} – Zylo EV` : 'Zylo EV Charging Station'}</title>
      </Head>

      <div className="flex h-screen overflow-hidden bg-slate-50">

        {/* Desktop sidebar */}
        <aside className={cn(
          'hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-200 ease-in-out',
          collapsed ? 'w-[60px]' : 'w-[230px]',
        )}>
          <SidebarContent />
        </aside>

        {/* Mobile overlay drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 flex flex-col w-[240px] bg-white h-full shadow-xl">
              <SidebarContent mobile />
            </aside>
          </div>
        )}

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <header className="flex-shrink-0 bg-white border-b border-slate-200 h-14 flex items-center px-4 gap-3 shadow-sm">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop expand (only when collapsed) */}
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                className="hidden lg:flex p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <h1 className="text-sm font-semibold text-slate-900 flex-1 truncate">
              {title || 'Zylo EV Charging Station'}
            </h1>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className="text-[10px] capitalize bg-blue-50 text-blue-700 border border-blue-200 hidden sm:inline-flex">
                {roleLabel}
              </Badge>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>

        </div>
      </div>
    </>
  );
}
