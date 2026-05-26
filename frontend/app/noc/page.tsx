'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { oltApi, alertsApi } from '@/lib/api';
import type { OLT, AlertEvent } from '@/lib/types';
import {
  Network, Wifi, AlertTriangle, CheckCircle2, XCircle,
  Clock, Activity, RefreshCw, Maximize2, Radio,
} from 'lucide-react';
import { clsx } from 'clsx';

const REFRESH_INTERVAL = 30_000; // 30 s

const STATUS_COLOR: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  active:      { bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', dot: 'bg-emerald-400',  label: 'ACTIVE' },
  error:       { bg: 'bg-red-950/60',     border: 'border-red-500/40',     dot: 'bg-red-400',      label: 'ERROR'  },
  offline:     { bg: 'bg-gray-800/60',    border: 'border-gray-600/40',    dot: 'bg-gray-500',     label: 'OFFLINE'},
  configuring: { bg: 'bg-yellow-950/60',  border: 'border-yellow-500/40',  dot: 'bg-yellow-400',   label: 'CONFIG' },
  pending:     { bg: 'bg-blue-950/60',    border: 'border-blue-500/40',    dot: 'bg-blue-400',     label: 'PENDING'},
};

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function Dot({ color }: { color: string }) {
  return <span className={clsx('inline-block w-2.5 h-2.5 rounded-full shrink-0', color)} />;
}

function StatPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-8 py-4 rounded-2xl border', color)}>
      <span className="text-4xl font-black tabular-nums leading-none">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-widest mt-1 opacity-70">{label}</span>
    </div>
  );
}

export default function NOCPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const time = useClock();

  const [olts, setOlts] = useState<OLT[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [oltRes, alertRes] = await Promise.all([
        oltApi.list(),
        alertsApi.getEvents(),
      ]);
      // Collect all pages if paginated
      const results = oltRes.data.results ?? (oltRes.data as any);
      setOlts(Array.isArray(results) ? results : []);
      setAlerts((alertRes.data as AlertEvent[]).slice(0, 8));
      setLastRefresh(new Date());
    } catch {
      // silently keep stale data
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchAll]);

  // Derived stats
  const activeOlts  = olts.filter(o => o.status === 'active').length;
  const errorOlts   = olts.filter(o => o.status === 'error' || o.status === 'offline').length;
  const totalOnus   = olts.reduce((s, o) => s + o.onu_count, 0);
  const onlineOnus  = olts.reduce((s, o) => s + o.registered_onu_count, 0);
  const healthPct   = olts.length ? Math.round((activeOlts / olts.length) * 100) : 0;
  const recentAlerts = alerts.filter(a => {
    const mins = (Date.now() - new Date(a.triggered_at).getTime()) / 60000;
    return mins < 120;
  }).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none overflow-hidden">

      {/* ── Top bar ── */}
      <header className="shrink-0 flex items-center justify-between px-8 py-4 border-b border-white/10 bg-gray-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Auto OLT</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Network Operations Center</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Health bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Network Health</span>
            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500',
                  healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-yellow-500' : 'bg-red-500',
                )}
                style={{ width: `${healthPct}%` }}
              />
            </div>
            <span className={clsx(
              'text-lg font-bold tabular-nums',
              healthPct >= 80 ? 'text-emerald-400' : healthPct >= 50 ? 'text-yellow-400' : 'text-red-400',
            )}>
              {healthPct}%
            </span>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Live</span>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-lg font-mono font-bold tabular-nums">{time}</span>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAll}
            disabled={refreshing}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh now"
          >
            <RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Summary stats ── */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-8 py-5 border-b border-white/10">
        <StatPill
          value={olts.length}
          label="Total OLTs"
          color="bg-blue-950/50 border-blue-500/30 text-blue-300"
        />
        <StatPill
          value={activeOlts}
          label="OLTs Online"
          color="bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
        />
        <StatPill
          value={errorOlts}
          label="OLTs Down"
          color={errorOlts > 0 ? 'bg-red-950/50 border-red-500/30 text-red-300' : 'bg-gray-800/50 border-gray-600/30 text-gray-400'}
        />
        <StatPill
          value={totalOnus}
          label="Total ONUs"
          color="bg-indigo-950/50 border-indigo-500/30 text-indigo-300"
        />
        <StatPill
          value={onlineOnus}
          label="ONUs Registered"
          color="bg-violet-950/50 border-violet-500/30 text-violet-300"
        />
        <StatPill
          value={recentAlerts}
          label="Recent Alerts"
          color={recentAlerts > 0 ? 'bg-orange-950/50 border-orange-500/30 text-orange-300' : 'bg-gray-800/50 border-gray-600/30 text-gray-400'}
        />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* OLT grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {olts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Radio className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">No OLT devices found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {olts.map(olt => {
                const s = STATUS_COLOR[olt.status] ?? STATUS_COLOR.offline;
                const utilPct = olt.onu_count > 0
                  ? Math.round((olt.registered_onu_count / olt.onu_count) * 100)
                  : 0;
                return (
                  <div
                    key={olt.id}
                    className={clsx(
                      'rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-300',
                      s.bg, s.border,
                    )}
                  >
                    {/* Status row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Dot color={clsx(s.dot, olt.status === 'active' && 'shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]')} />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{s.label}</span>
                      </div>
                      {olt.status === 'active'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 opacity-70" />
                        : olt.status === 'error'
                          ? <XCircle className="h-3.5 w-3.5 text-red-400 opacity-70" />
                          : <AlertTriangle className="h-3.5 w-3.5 text-gray-500 opacity-70" />}
                    </div>

                    {/* OLT name */}
                    <div>
                      <p className="text-sm font-bold text-white truncate">{olt.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono truncate mt-0.5">{olt.ip_address}</p>
                    </div>

                    {/* ONU count */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Wifi className="h-3 w-3" />
                        ONUs
                      </span>
                      <span className="font-bold tabular-nums">
                        <span className="text-white">{olt.registered_onu_count}</span>
                        <span className="text-gray-600"> / {olt.onu_count}</span>
                      </span>
                    </div>

                    {/* Utilisation bar */}
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          utilPct >= 90 ? 'bg-red-500' : utilPct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>

                    {/* Last polled */}
                    {olt.last_polled && (
                      <p className="text-[9px] text-gray-600 truncate">
                        Polled {new Date(olt.last_polled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Alerts panel ── */}
        <aside className="shrink-0 w-80 border-l border-white/10 bg-gray-900/60 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
            <Activity className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-300">Recent Alerts</h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <p className="text-xs">No recent alerts</p>
              </div>
            ) : (
              alerts.map(a => {
                const mins = Math.round((Date.now() - new Date(a.triggered_at).getTime()) / 60000);
                const age = mins < 60
                  ? `${mins}m ago`
                  : `${Math.round(mins / 60)}h ago`;
                return (
                  <div key={a.id} className="px-5 py-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{a.olt_name}</p>
                        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mt-0.5">{a.message}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{age}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Loading…'}
            </span>
            <span className="text-[10px] text-gray-600">Every 30s</span>
          </div>
        </aside>

      </div>
    </div>
  );
}
