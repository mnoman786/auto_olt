'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { signalApi, onuApi } from '@/lib/api';
import type { SignalHistoryResponse, ONU } from '@/lib/types';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { ArrowLeft, Activity, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const HOURS_OPTIONS = [6, 12, 24, 48, 168] as const;
type Hours = typeof HOURS_OPTIONS[number];

function fmtHours(h: Hours) {
  if (h < 24) return `${h}h`;
  if (h === 24) return '24h';
  if (h === 48) return '2d';
  return '7d';
}

function signalColor(rxPower: number | null) {
  if (rxPower === null) return 'text-gray-400';
  if (rxPower >= -20) return 'text-green-600 dark:text-green-400';
  if (rxPower >= -27) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function signalLabel(rxPower: number | null) {
  if (rxPower === null) return 'Unknown';
  if (rxPower >= -20) return 'Excellent';
  if (rxPower >= -27) return 'Good';
  if (rxPower >= -30) return 'Weak';
  return 'Critical';
}

export default function SignalHistoryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);
  const onuId = parseInt(params.onuId as string);

  const [onu, setOnu] = useState<ONU | null>(null);
  const [data, setData] = useState<SignalHistoryResponse | null>(null);
  const [hours, setHours] = useState<Hours>(24);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    onuApi.get(oltId, onuId).then(r => setOnu(r.data)).catch(() => {});
  }, [isAuthenticated, oltId, onuId]);

  const load = useCallback(async (h: Hours, silent = false) => {
    if (!silent) setFetching(true); else setRefreshing(true);
    try {
      const res = await signalApi.getHistory(oltId, onuId, h);
      setData(res.data);
    } catch {
      toast.error('Failed to load signal history');
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  }, [oltId, onuId]);

  useEffect(() => { if (isAuthenticated) load(hours); }, [isAuthenticated, load, hours]);

  const chartData = data?.samples.map(s => ({
    t: new Date(s.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    'Rx Power (dBm)': s.rx_power,
  })) ?? [];

  const minSample = data ? Math.min(...data.samples.map(s => s.rx_power), 0) : -35;
  const maxSample = data ? Math.max(...data.samples.map(s => s.rx_power), -10) : -10;

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4 animate-pulse max-w-4xl mx-auto">
          <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Back */}
        <Link href={`/olts/${oltId}/onus`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to ONUs
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
              <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                {onu?.serial_number ?? `ONU #${onuId}`}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {onu?.pon_port} · Signal History
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
              {HOURS_OPTIONS.map(h => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={clsx(
                    'px-3 py-1.5 transition-colors',
                    hours === h
                      ? 'bg-cyan-600 text-white font-medium'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
                  )}
                >
                  {fmtHours(h)}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => load(hours, true)} icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Current signal stat */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Current Signal', value: data?.current_signal != null ? `${data.current_signal.toFixed(1)} dBm` : 'N/A', sub: signalLabel(data?.current_signal ?? null), color: signalColor(data?.current_signal ?? null) },
            { label: 'Samples', value: data?.samples.length ?? 0, sub: `Last ${fmtHours(hours)}` },
            { label: 'Min', value: data?.samples.length ? `${Math.min(...data.samples.map(s => s.rx_power)).toFixed(1)} dBm` : 'N/A', sub: 'Worst reading' },
            { label: 'Max', value: data?.samples.length ? `${Math.max(...data.samples.map(s => s.rx_power)).toFixed(1)} dBm` : 'N/A', sub: 'Best reading' },
          ].map(s => (
            <Card key={s.label} className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={clsx('text-lg font-bold', s.color ?? 'text-gray-900 dark:text-white')}>{s.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Rx Power over Time</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dashed lines: -20 dBm (good), -27 dBm (weak threshold)</p>
          </div>
          {chartData.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No signal data yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Samples are collected each time ONUs are polled</p>
            </div>
          ) : (
            <div className="p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-700" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-gray-500 dark:text-gray-400" interval="preserveStartEnd" minTickGap={60} />
                  <YAxis
                    domain={[Math.floor(minSample) - 2, Math.ceil(maxSample) + 2]}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    className="text-gray-500 dark:text-gray-400"
                    tickFormatter={v => `${v}`}
                    width={44}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(2)} dBm`, 'Rx Power']}
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <ReferenceLine y={-20} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1.5} />
                  <ReferenceLine y={-27} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
                  <Line
                    type="monotone"
                    dataKey="Rx Power (dBm)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
