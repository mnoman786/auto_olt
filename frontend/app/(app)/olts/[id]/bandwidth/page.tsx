'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { BandwidthSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { oltApi } from '@/lib/api';
import type { OLT, BandwidthPort } from '@/lib/types';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { ArrowLeft, RefreshCw, Activity, Wifi } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const HOURS_OPTIONS = [1, 3, 6, 12, 24, 48, 168] as const;
type Hours = typeof HOURS_OPTIONS[number];

function fmtHours(h: Hours) {
  if (h < 24) return `${h}h`;
  if (h === 24) return '24h';
  if (h === 48) return '2d';
  return '7d';
}

function fmtTime(iso: string, hours: Hours) {
  const d = new Date(iso);
  if (hours <= 6) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hours <= 48) return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMbps(val: number) {
  if (val >= 1000) return `${(val / 1000).toFixed(2)} Gbps`;
  if (val >= 1) return `${val.toFixed(2)} Mbps`;
  return `${(val * 1000).toFixed(0)} Kbps`;
}

function PortChart({ port, hours }: { port: BandwidthPort; hours: Hours }) {
  const data = port.samples.map(s => ({
    t: fmtTime(s.t, hours),
    'In (Mbps)': parseFloat(s.in_mbps.toFixed(4)),
    'Out (Mbps)': parseFloat(s.out_mbps.toFixed(4)),
  }));

  const maxVal = Math.max(
    ...port.samples.map(s => Math.max(s.in_mbps, s.out_mbps)),
    0.001,
  );

  const tickCount = maxVal >= 1000 ? 5 : 5;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-cyan-500" />
          <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{port.port_name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {port.port_type}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Peak In:{' '}
            <strong className="text-blue-600 dark:text-blue-400">
              {formatMbps(Math.max(...port.samples.map(s => s.in_mbps), 0))}
            </strong>
          </span>
          <span>
            Peak Out:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatMbps(Math.max(...port.samples.map(s => s.out_mbps), 0))}
            </strong>
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-sm text-gray-400 dark:text-gray-500">
          No samples in this window
        </div>
      ) : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`in-${port.port_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`out-${port.port_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-700" />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-gray-500 dark:text-gray-400"
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tickCount={tickCount}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-gray-500 dark:text-gray-400"
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}G` : `${v}M`}
                width={48}
              />
              <Tooltip
                formatter={(value, name) => [formatMbps(Number(value ?? 0)), String(name)]}
                contentStyle={{
                  background: 'var(--tooltip-bg, #1f2937)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="In (Mbps)"
                stroke="#3b82f6"
                strokeWidth={2}
                fill={`url(#in-${port.port_id})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Out (Mbps)"
                stroke="#10b981"
                strokeWidth={2}
                fill={`url(#out-${port.port_id})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default function BandwidthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [ports, setPorts] = useState<BandwidthPort[]>([]);
  const [hours, setHours] = useState<Hours>(24);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  // Fetch OLT info once — doesn't change when hours changes
  useEffect(() => {
    if (!isAuthenticated) return;
    oltApi.get(oltId).then(r => setOlt(r.data)).catch(() => {});
  }, [isAuthenticated, oltId]);

  const load = useCallback(async (h: Hours, silent = false) => {
    if (!silent) setFetching(true);
    else setRefreshing(true);
    try {
      const bwRes = await oltApi.getBandwidth(oltId, { hours: h });
      setPorts(bwRes.data.ports);
    } catch {
      toast.error('Failed to load bandwidth data');
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  }, [oltId]);

  useEffect(() => {
    if (isAuthenticated) load(hours);
  }, [isAuthenticated, load, hours]);

  const handleHoursChange = (h: Hours) => {
    setHours(h);
  };

  const totalSamples = ports.reduce((s, p) => s + p.samples.length, 0);

  if (isLoading || fetching) {
    return (
        <BandwidthSkeleton />
    );
  }

  return (
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-cyan-50/70 dark:from-cyan-950/20 via-sky-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-6xl mx-auto">
          <Link
            href={`/olts/${oltId}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to OLT
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-cyan-50 to-sky-100 dark:from-cyan-900/30 dark:to-sky-900/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm shrink-0">
                <Activity className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600/80 dark:text-cyan-400/80">Monitoring</p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Traffic Graphs</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{olt?.name} &mdash; {olt?.ip_address}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0.5">
                {HOURS_OPTIONS.map(h => (
                  <button
                    key={h}
                    onClick={() => handleHoursChange(h)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      hours === h
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    )}
                  >
                    {fmtHours(h)}
                  </button>
                ))}
              </div>
              <Button
                icon={<RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />}
                onClick={() => load(hours, true)}
                loading={refreshing}
                variant="outline"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Summary row */}
          {ports.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Ports Monitored', value: ports.length,   color: 'text-cyan-600' },
                { label: 'Total Samples',   value: totalSamples,   color: 'text-gray-700 dark:text-gray-300' },
                {
                  label: 'Peak In',
                  value: formatMbps(Math.max(...ports.flatMap(p => p.samples.map(s => s.in_mbps)), 0)),
                  color: 'text-blue-600',
                },
                {
                  label: 'Peak Out',
                  value: formatMbps(Math.max(...ports.flatMap(p => p.samples.map(s => s.out_mbps)), 0)),
                  color: 'text-emerald-600',
                },
              ].map(s => (
                <Card key={s.label} padding="sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                  <p className={clsx('text-xl font-bold truncate', s.color)}>{s.value}</p>
                </Card>
              ))}
            </div>
          )}

          {ports.length === 0 ? (
            <Card>
              <div className="text-center py-16">
                <Activity className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-gray-600 dark:text-gray-300 font-medium mb-1">No bandwidth data yet</h3>
                <p className="text-gray-400 dark:text-gray-500 text-sm max-w-sm mx-auto">
                  Bandwidth samples are collected automatically every 5 minutes from active OLTs.
                  Make sure the OLT status is <strong>Active</strong> and ports have been discovered.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {ports.map(port => (
                <PortChart key={port.port_id} port={port} hours={hours} />
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
