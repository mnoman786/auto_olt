'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { oltApi } from '@/lib/api';
import type { OLT, OLTPort } from '@/lib/types';
import { ArrowLeft, Cpu, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function utilColor(pct: number | null) {
  if (pct === null) return { bar: 'bg-gray-300', text: 'text-gray-500' };
  if (pct >= 80) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  if (pct >= 60) return { bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
}

export default function CapacityPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [ports, setPorts] = useState<OLTPort[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = async () => {
    try {
      const [oltRes, portsRes] = await Promise.all([
        oltApi.get(oltId),
        oltApi.getPorts(oltId),
      ]);
      setOlt(oltRes.data);
      setPorts(portsRes.data.ports ?? []);
    } catch {
      toast.error('Failed to load port data');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, oltId]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await oltApi.discoverPorts(oltId);
      setPorts(res.data.ports ?? []);
      toast.success(`Discovered ${res.data.count} port(s)`);
    } catch {
      toast.error('Port discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const ponPorts = ports.filter(p => p.port_type === 'pon');
  const criticalPorts = ponPorts.filter(p => (p.utilization_pct ?? 0) >= 80);

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Back */}
        <Link href={`/olts/${oltId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to OLT
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Port Capacity</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{olt?.name} — {ponPorts.length} PON port{ponPorts.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`h-4 w-4 ${discovering ? 'animate-spin' : ''}`} />}
            loading={discovering}
            onClick={handleDiscover}
          >
            Re-discover Ports
          </Button>
        </div>

        {/* Warning banner */}
        {criticalPorts.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {criticalPorts.length} port{criticalPorts.length !== 1 ? 's' : ''} above 80% capacity
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                {criticalPorts.map(p => p.name).join(', ')} — consider adding capacity soon
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'PON Ports', value: ponPorts.length },
            { label: 'Total ONUs', value: ponPorts.reduce((s, p) => s + p.onu_count, 0) },
            { label: 'Total Capacity', value: ponPorts.reduce((s, p) => s + p.max_capacity, 0) },
            { label: 'Near Full (≥80%)', value: criticalPorts.length, danger: criticalPorts.length > 0 },
          ].map(s => (
            <Card key={s.label} className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={clsx('text-2xl font-bold', s.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Port utilization list */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">PON Port Utilization</h2>
          </div>
          {ponPorts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Cpu className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No ports discovered yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click <strong>Re-discover Ports</strong> to read from the OLT via SNMP</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {ponPorts
                .sort((a, b) => (b.utilization_pct ?? 0) - (a.utilization_pct ?? 0))
                .map(port => {
                  const pct = port.utilization_pct ?? 0;
                  const colors = utilColor(port.utilization_pct);
                  return (
                    <div key={port.id} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">{port.name}</span>
                          <span className={clsx(
                            'text-xs px-1.5 py-0.5 rounded font-medium',
                            port.status === 'up' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500',
                          )}>
                            {port.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={clsx('text-sm font-bold', colors.text)}>{pct.toFixed(1)}%</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{port.onu_count} / {port.max_capacity}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all', colors.bar)}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>

        {/* Non-PON ports */}
        {ports.filter(p => p.port_type !== 'pon').length > 0 && (
          <Card padding="none" className="overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Uplink / Other Ports</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {ports.filter(p => p.port_type !== 'pon').map(port => (
                <div key={port.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{port.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{port.port_type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{port.speed_mbps ? `${port.speed_mbps} Mbps` : '—'}</span>
                    <span className={clsx(
                      'px-1.5 py-0.5 rounded font-medium',
                      port.status === 'up' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500',
                    )}>
                      {port.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
