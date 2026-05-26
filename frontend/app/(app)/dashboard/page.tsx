'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OLTStatusBadge } from '@/components/ui/Badge';
import { oltApi } from '@/lib/api';
import { OLT } from '@/lib/types';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import {
  Server, Wifi, AlertCircle, Plus, RefreshCw,
  ChevronRight, Activity, Network, Cpu, User,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';

const statusDot = {
  active: 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)]',
  error: 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]',
  configuring: 'bg-blue-500 animate-pulse shadow-[0_0_0_3px_rgba(59,130,246,0.18)]',
  pending: 'bg-gray-400',
  offline: 'bg-gray-400',
} as const;

function OltRowSkeleton() {
  return (
    <div className="px-6 py-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700" />
          <div className="space-y-2">
            <div className="h-3.5 w-32 bg-gray-100 dark:bg-gray-700 rounded" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-3 w-24 bg-gray-100 dark:bg-gray-700 rounded hidden md:block" />
          <div className="h-6 w-16 bg-gray-100 dark:bg-gray-700 rounded-full" />
          <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isStaff = user?.is_staff || user?.is_superuser;
  const router = useRouter();
  const [olts, setOlts] = useState<OLT[]>([]);
  const [oltCount, setOltCount] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchOlts = useCallback(async () => {
    setFetching(true);
    try {
      const res = await oltApi.list(page);
      setOlts(res.data.results ?? (res.data as any));
      setOltCount(res.data.count ?? 0);
    } catch (e) {
      toast.error('Failed to load OLTs');
    } finally {
      setFetching(false);
    }
  }, [page]);

  useEffect(() => { if (isAuthenticated) fetchOlts(); }, [isAuthenticated, fetchOlts]);

  if (isLoading) return <DashboardSkeleton />;

  const activeOlts = olts.filter(o => o.status === 'active').length;
  const errorOlts = olts.filter(o => o.status === 'error').length;
  const totalOnus = olts.reduce((s, o) => s + o.onu_count, 0);
  const registeredOnus = olts.reduce((s, o) => s + o.registered_onu_count, 0);
  const healthPct = olts.length ? Math.round((activeOlts / olts.length) * 100) : 0;
  const regPct = totalOnus ? Math.round((registeredOnus / totalOnus) * 100) : 0;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const displayName = (user as any)?.first_name || (user as any)?.username || '';

  return (
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />

        <div className="relative p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">
                Dashboard
              </p>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {greeting}{displayName ? `, ${displayName}` : ''}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
                Here's a snapshot of your OLT network today.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={<RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />}
                onClick={fetchOlts}
                loading={fetching}
              >
                Refresh
              </Button>
              <Link href="/olts/add">
                <Button icon={<Plus className="h-4 w-4" />}>Add OLT</Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total OLTs"
              value={olts.length}
              icon={<Server className="h-5 w-5" />}
              color="blue"
              subtitle={olts.length ? `${activeOlts} online` : 'No devices yet'}
            />
            <StatCard
              label="Network Health"
              value={`${healthPct}%`}
              icon={<Activity className="h-5 w-5" />}
              color={healthPct >= 80 ? 'green' : healthPct >= 50 ? 'yellow' : 'red'}
              subtitle={`${activeOlts} of ${olts.length || 0} active`}
            />
            <StatCard
              label="Total ONUs"
              value={totalOnus}
              icon={<Wifi className="h-5 w-5" />}
              color="blue"
              subtitle={`${registeredOnus} registered • ${regPct}%`}
            />
            <StatCard
              label="Issues"
              value={errorOlts}
              icon={<AlertCircle className="h-5 w-5" />}
              color={errorOlts > 0 ? 'red' : 'gray'}
              subtitle={errorOlts > 0 ? 'Needs attention' : 'All clear'}
            />
          </div>

          {/* OLT List */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-linear-to-r from-gray-50/60 dark:from-gray-800/60 to-transparent">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">{isStaff ? 'All OLT Devices' : 'Your OLT Devices'}</h2>
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                {olts.length} device{olts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {fetching ? (
              <div className="divide-y divide-gray-100">
                <OltRowSkeleton />
                <OltRowSkeleton />
                <OltRowSkeleton />
              </div>
            ) : olts.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
                  <Server className="h-7 w-7 text-blue-500 dark:text-blue-400" />
                </div>
                <p className="text-gray-900 dark:text-white font-semibold">No OLT devices yet</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 mb-5 max-w-sm mx-auto">
                  Add your first OLT to start auto-provisioning and monitoring your PON network.
                </p>
                <Link href="/olts/add">
                  <Button icon={<Plus className="h-4 w-4" />}>Add your first OLT</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {olts.map(olt => {
                  const dot = statusDot[olt.status as keyof typeof statusDot] ?? statusDot.pending;
                  return (
                    <Link
                      key={olt.id}
                      href={`/olts/${olt.id}`}
                      className="group block px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                              <Cpu className="h-5 w-5" />
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${dot}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {olt.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {olt.ip_address}
                              {olt.system_name ? ` • ${olt.system_name}` : ''}
                              {olt.system_uptime ? ` • ↑ ${olt.system_uptime}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden lg:flex items-center gap-3 text-xs text-gray-500">
                            {isStaff && (
                              <span className="inline-flex items-center gap-1 w-24 text-gray-400 truncate">
                                <User className="h-3 w-3 shrink-0" />
                                <span className="font-medium text-gray-600 dark:text-gray-300 truncate">{olt.username}</span>
                              </span>
                            )}
                            <span className="inline-flex items-center justify-center w-12 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-medium dark:text-gray-300 text-center">
                              {olt.snmp_version.toUpperCase()}
                            </span>
                            <span className="inline-flex items-center gap-1 w-28">
                              <Wifi className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <span className="text-gray-700 dark:text-gray-300 font-medium tabular-nums">{olt.onu_count}</span>
                              <span className="text-gray-400 dark:text-gray-500 tabular-nums">/ {olt.registered_onu_count} reg</span>
                            </span>
                          </div>
                          <span className="w-20 flex justify-center">
                            <OLTStatusBadge status={olt.status} />
                          </span>
                          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <Pagination
              count={oltCount}
              pageSize={20}
              page={page}
              onPageChange={setPage}
            />
          </Card>
        </div>
      </div>
  );
}
