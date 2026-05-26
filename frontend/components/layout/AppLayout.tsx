'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import {
  LayoutDashboard, Server, Network, LogOut, ChevronRight, Menu, X, BookOpen,
  Bell, Search, LifeBuoy, UserCircle, ShieldCheck, Gift, Sun, Moon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/olts',      label: 'OLT Devices', icon: Server },
  { href: '/alerts',    label: 'Alerts', icon: Bell },
  { href: '/tickets',   label: 'Support', icon: LifeBuoy },
  { href: '/docs',      label: 'Documentation', icon: BookOpen },
  { href: '/plans',     label: 'Plans & Pricing', icon: Gift, highlight: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const isAdmin = user?.is_staff || user?.is_superuser;
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (localStorage.getItem('sidebar_collapsed') === 'true') setCollapsed(true);
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsed]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) localStorage.setItem('sidebar_collapsed', 'true');
    else localStorage.removeItem('sidebar_collapsed');
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    router.push('/login');
  };

  const initials = (user?.username || '?').slice(0, 2).toUpperCase();

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 flex flex-col',
        sidebarReady && 'transition-all duration-300',
        'bg-white border-r border-gray-200',
        'dark:bg-gray-900 dark:border-gray-700/60',
        'lg:relative lg:translate-x-0 lg:flex lg:h-screen',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'w-16' : 'w-64',
      )}>

        {/* Collapse toggle — centred on the logo row, right edge */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'hidden lg:flex absolute -right-3 top-[19px] z-50 w-6 h-6',
            'items-center justify-center rounded-full shadow-md transition-colors',
            'bg-white border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700',
            'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
          )}
        >
          <ChevronRight className={clsx('h-3 w-3 transition-transform', !collapsed && 'rotate-180')} />
        </button>

        {/* Logo */}
        <div className={clsx(
          'flex items-center gap-3 h-14 shrink-0 transition-all duration-300',
          'border-b border-gray-200 dark:border-gray-700/60',
          collapsed ? 'px-3 justify-center' : 'px-5',
        )}>
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
            <Network className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">Auto OLT</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">ISP Management</p>
            </div>
          )}
          <button
            className="lg:hidden text-gray-400 hover:text-gray-700 dark:hover:text-white ml-auto"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-0.5">
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Workspace
            </p>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const isHighlight = (item as any).highlight;
            return (
              <div key={item.href} className="relative group/tip">
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    'group flex items-center gap-3 rounded-lg text-sm font-medium transition-all',
                    collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                    active
                      ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                      : isHighlight
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white',
                  )}
                >
                  <Icon className={clsx('h-4 w-4 shrink-0 transition-transform', !active && 'group-hover:scale-110')} />
                  {!collapsed && (
                    <>
                      {item.label}
                      {isHighlight && !active && (
                        <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded uppercase tracking-wide">Free</span>
                      )}
                      {active && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                    </>
                  )}
                </Link>
                {collapsed && (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 bg-gray-900 text-white dark:bg-gray-700 dark:text-gray-100 shadow-lg">
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}

          {isAdmin && (
            <>
              {!collapsed && (
                <p className="px-3 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Administration
                </p>
              )}
              {(() => {
                const active = pathname.startsWith('/admin');
                return (
                  <div className="relative group/tip">
                    <Link
                      href="/admin/users"
                      onClick={() => setSidebarOpen(false)}
                      className={clsx(
                        'group flex items-center gap-3 rounded-lg text-sm font-medium transition-all',
                        collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                        active
                          ? 'bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-500/20'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white',
                      )}
                    >
                      <ShieldCheck className={clsx('h-4 w-4 shrink-0 transition-transform', !active && 'group-hover:scale-110')} />
                      {!collapsed && (
                        <>
                          User Management
                          {active && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                        </>
                      )}
                    </Link>
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 bg-gray-900 text-white dark:bg-gray-700 dark:text-gray-100 shadow-lg">
                        User Management
                      </span>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </nav>

        {/* User section */}
        <div className={clsx(
          'border-t border-gray-200 dark:border-gray-700/60 py-3',
          collapsed ? 'px-2' : 'px-3',
        )}>
          <div className={clsx(
            'flex items-center gap-3',
            collapsed ? 'justify-center' : 'px-2 py-1',
          )}>
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.username}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Top bar */}
        <header className="shrink-0 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-700/80 flex items-center px-4 gap-2 z-30">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <button className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Search" type="button">
            <Search className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative" aria-label="Notifications" type="button">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
          </button>
          <button onClick={toggle} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme" type="button">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div ref={profileRef} className="relative hidden sm:block pl-3 ml-1 border-l border-gray-200 dark:border-gray-700">
            <button onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">{initials}</div>
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{user?.username}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-gray-200/80 dark:shadow-gray-900/80 border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{initials}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <UserCircle className="h-4 w-4 text-gray-400" />
                    Profile
                  </Link>
                  <button onClick={() => { setProfileOpen(false); handleLogout(); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
