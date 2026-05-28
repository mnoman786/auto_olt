'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminApi } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import { BarChart2, Users, Wifi, Megaphone, Loader2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const OLT_ORDER = ['1–5', '6–20', '21–50', '50+'];
const HEARD_ORDER = ['WhatsApp Group', 'Facebook', 'Friend / Referral', 'Google', 'Other'];

const BAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
  'bg-pink-500', 'bg-rose-500',
];

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-14 text-right shrink-0">
        {count} <span className="text-gray-400 font-normal">({pct}%)</span>
      </span>
    </div>
  );
}

function ChartCard({ title, icon: Icon, rows, total, emptyLabel }: {
  title: string; icon: React.ElementType;
  rows: { label: string; count: number }[];
  total: number; emptyLabel: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="h-4 w-4 text-violet-500" />
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h2>
        <span className="ml-auto text-xs text-gray-400">{total} responses</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <BarRow key={r.label} label={r.label} count={r.count} total={total} color={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.is_staff || user?.is_superuser;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
    if (!isLoading && isAuthenticated && !isAdmin) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, isAdmin, router]);

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchUsers();
  }, [isAuthenticated, isAdmin, fetchUsers]);

  // Aggregate
  const oltCounts = OLT_ORDER.map(label => ({
    label,
    count: users.filter(u => (u as any).olt_count_range === label).length,
  }));
  const heardCounts = HEARD_ORDER.map(label => ({
    label,
    count: users.filter(u => (u as any).heard_from === label).length,
  }));
  const oltTotal   = oltCounts.reduce((s, r) => s + r.count, 0);
  const heardTotal = heardCounts.reduce((s, r) => s + r.count, 0);

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const totalOlts = users.reduce((s, u) => s + u.olt_count, 0);
  const usersWithCompany = users.filter(u => (u as any).company_name).length;

  if (isLoading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <BarChart2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 rounded-full">
              Admin
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">User registrations and network insights</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={fetching}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', fetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',     value: totalUsers,        icon: Users,    color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/30' },
          { label: 'Active Users',    value: activeUsers,       icon: Users,    color: 'text-emerald-600',bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          { label: 'Total OLTs',      value: totalOlts,         icon: Wifi,     color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/30' },
          { label: 'With Company',    value: usersWithCompany,  icon: Megaphone,color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', bg)}>
              <Icon className={clsx('h-5 w-5', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard
            title="OLTs per user"
            icon={Wifi}
            rows={oltCounts}
            total={oltTotal}
            emptyLabel="No OLT range data yet"
          />
          <ChartCard
            title="How users heard about us"
            icon={Megaphone}
            rows={heardCounts}
            total={heardTotal}
            emptyLabel="No referral data yet"
          />
        </div>
      )}
    </div>
  );
}
