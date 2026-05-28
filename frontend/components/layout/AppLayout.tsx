'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import {
  LayoutDashboard, Server, Network, LogOut, ChevronRight, Menu, X, BookOpen,
  Bell, LifeBuoy, UserCircle, ShieldCheck, Gift, Sun, Moon, MonitorPlay, Megaphone,
  CheckCheck, Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import AnnouncementBanner from '@/components/ui/AnnouncementBanner';
import { notificationsApi } from '@/lib/api';
import type { Notification } from '@/lib/types';

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws')
  .replace(/\/api\/?$/, '');

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/olts',       label: 'OLT Devices',   icon: Server },
  { href: '/customers',  label: 'Customers',      icon: Users },
  { href: '/alerts',     label: 'Alerts',         icon: Bell },
  { href: '/noc',        label: 'NOC View',       icon: MonitorPlay, newTab: true },
  { href: '/tickets',    label: 'Support',        icon: LifeBuoy },
  { href: '/docs',       label: 'Documentation',  icon: BookOpen },
  { href: '/plans',      label: 'Plans & Pricing',icon: Gift, highlight: true },
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
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const seenIdsRef = useRef<Set<number>>(new Set());;

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
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load existing notifications on mount
  const fetchNotifications = useCallback(() => {
    if (!user) return;
    notificationsApi.list()
      .then(r => {
        const list: Notification[] = (r.data as any).results ?? r.data;
        list.forEach(n => seenIdsRef.current.add(n.id));
        setNotifications(list);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // WebSocket for real-time push
  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      // Access token cookie is sent automatically on the WS upgrade request
      ws = new WebSocket(`${WS_BASE}/ws/notifications/`);

      ws.onopen = () => { reconnectDelay = 1000; };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            const n: Notification = data;
            if (!seenIdsRef.current.has(n.id)) {
              seenIdsRef.current.add(n.id);
              setNotifications(prev => [n, ...prev]);
              toast(n.message, { icon: '🔔' });
            }
          }

          if (data.type === 'ticket_status_changed' || data.type === 'ticket_reply_added') {
            window.dispatchEvent(new CustomEvent('ticket-notification', { detail: { ticketId: data.ticket_id } }));
          }
        } catch {}
      };

      ws.onclose = () => {
        if (destroyed) return;
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
          connect();
        }, reconnectDelay);
      };
    }

    connect();
    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function handleNotificationClick(n: Notification) {
    setBellOpen(false);
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      await notificationsApi.markRead(n.id).catch(() => {});
    }
    router.push(`/tickets/${n.ticket_id}`);
  }

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    await notificationsApi.markAllRead().catch(() => {});
  }

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
            const isNewTab = (item as any).newTab;
            const active = !isNewTab && (pathname === item.href || pathname.startsWith(item.href + '/'));
            const isHighlight = (item as any).highlight;
            return (
              <div key={item.href} className="relative group/tip">
                <Link
                  href={item.href}
                  target={isNewTab ? '_blank' : undefined}
                  rel={isNewTab ? 'noopener noreferrer' : undefined}
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
              {[
                { href: '/admin/users', label: 'User Management', icon: ShieldCheck },
                { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
              ].map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <div key={href} className="relative group/tip">
                    <Link
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={clsx(
                        'group flex items-center gap-3 rounded-lg text-sm font-medium transition-all',
                        collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                        active
                          ? 'bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-purple-500/20'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white',
                      )}
                    >
                      <Icon className={clsx('h-4 w-4 shrink-0 transition-transform', !active && 'group-hover:scale-110')} />
                      {!collapsed && (
                        <>
                          {label}
                          {active && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                        </>
                      )}
                    </Link>
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap z-50 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 bg-gray-900 text-white dark:bg-gray-700 dark:text-gray-100 shadow-lg">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
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
            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Sign out"
                className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
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
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setBellOpen(v => !v)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
              aria-label="Notifications"
              type="button"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 flex items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg shadow-gray-200/80 dark:shadow-gray-900/80 border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={clsx(
                          'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                          !n.is_read && 'bg-blue-50/60 dark:bg-blue-900/10',
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {!n.is_read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                          <div className={clsx('flex-1 min-w-0', n.is_read && 'pl-4')}>
                            <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2">{n.message}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={toggle} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme" type="button">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div ref={profileRef} className="relative pl-3 ml-1 border-l border-gray-200 dark:border-gray-700">
            <button onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">{initials}</div>
              <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300 font-medium">{user?.username}</span>
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

        <AnnouncementBanner />
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
