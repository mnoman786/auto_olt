'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { oltApi } from '@/lib/api';
import type { OLT, OLTPort } from '@/lib/types';
import {
  ArrowLeft, RefreshCw, Wifi, Network, Link2,
  CheckCircle2, XCircle, HelpCircle, Layers
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function PortStatusBadge({ status }: { status: string }) {
  if (status === 'up') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
      <CheckCircle2 className="h-3 w-3" /> Up
    </span>
  );
  if (status === 'down') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
      <XCircle className="h-3 w-3" /> Down
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
      <HelpCircle className="h-3 w-3" /> Unknown
    </span>
  );
}

function PortTypeIcon({ type }: { type: string }) {
  if (type === 'pon') return <Wifi className="h-4 w-4 text-purple-500" />;
  if (type === 'uplink') return <Network className="h-4 w-4 text-blue-500" />;
  if (type === 'lag') return <Link2 className="h-4 w-4 text-orange-500" />;
  return <Layers className="h-4 w-4 text-gray-400" />;
}

function formatSpeed(mbps: number): string {
  if (mbps === 0) return '—';
  if (mbps >= 1000) return `${mbps / 1000}G`;
  return `${mbps}M`;
}

function PortSection({ title, ports, color }: { title: string; ports: OLTPort[]; color: string }) {
  if (ports.length === 0) return null;
  const up = ports.filter(p => p.status === 'up').length;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className={clsx('text-sm font-semibold uppercase tracking-wide', color)}>
          {title}
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">{up}/{ports.length} up</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ports.map(port => (
          <div
            key={port.id}
            className={clsx(
              'rounded-lg border p-4 transition-colors',
              port.status === 'up'
                ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500'
                : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <PortTypeIcon type={port.port_type} />
                <span className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {port.name}
                </span>
              </div>
              <PortStatusBadge status={port.status} />
            </div>

            {port.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{port.description}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Speed: <strong className="text-gray-700 dark:text-gray-300">{formatSpeed(port.speed_mbps)}</strong></span>
              {port.port_type === 'pon' && (
                <span>ONUs: <strong className="text-gray-700 dark:text-gray-300">{port.onu_count}</strong></span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OLTPortsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [ports, setPorts] = useState<OLTPort[]>([]);
  const [fetching, setFetching] = useState(true);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = useCallback(async () => {
    try {
      const [oltRes, portsRes] = await Promise.all([
        oltApi.get(oltId),
        oltApi.getPorts(oltId),
      ]);
      setOlt(oltRes.data);
      setPorts(portsRes.data.ports);
    } catch {
      toast.error('Failed to load ports');
    } finally {
      setFetching(false);
    }
  }, [oltId]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await oltApi.discoverPorts(oltId);
      setPorts(res.data.ports);
      toast.success(`Discovered ${res.data.count} ports`);
    } catch {
      toast.error('Port discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const ponPorts    = ports.filter(p => p.port_type === 'pon');
  const uplinkPorts = ports.filter(p => p.port_type === 'uplink');
  const lagPorts    = ports.filter(p => p.port_type === 'lag');
  const otherPorts  = ports.filter(p => p.port_type === 'other');

  const totalUp   = ports.filter(p => p.status === 'up').length;
  const totalOnus = ponPorts.reduce((s, p) => s + p.onu_count, 0);

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-purple-50/70 dark:from-purple-950/20 via-fuchsia-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-6xl mx-auto">
        <Link href={`/olts/${oltId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to OLT
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-purple-50 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm shrink-0">
              <Network className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-600/80 dark:text-purple-400/80">Hardware Inventory</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Ports & Uplinks</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{olt?.name} — {olt?.ip_address}</p>
            </div>
          </div>
          <Button
            icon={<RefreshCw className={clsx('h-4 w-4', discovering && 'animate-spin')} />}
            onClick={handleDiscover}
            loading={discovering}
            variant="outline"
          >
            Discover Ports
          </Button>
        </div>

        {/* Summary cards */}
        {ports.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Ports', value: ports.length,   color: 'text-gray-700' },
              { label: 'Ports Up',    value: totalUp,         color: 'text-green-600' },
              { label: 'PON Ports',   value: ponPorts.length, color: 'text-purple-600' },
              { label: 'Total ONUs',  value: totalOnus,       color: 'text-blue-600' },
            ].map(s => (
              <Card key={s.label} padding="sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
              </Card>
            ))}
          </div>
        )}

        {ports.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Network className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-gray-600 dark:text-gray-300 font-medium mb-1">No ports discovered yet</h3>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                Click "Discover Ports" to poll the OLT via SNMP and retrieve all port information.
              </p>
              <Button onClick={handleDiscover} loading={discovering} icon={<RefreshCw className="h-4 w-4" />}>
                Discover Ports
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            <PortSection title="PON / GPON Ports"  ports={ponPorts}    color="text-purple-600" />
            <PortSection title="Uplink Ports"       ports={uplinkPorts} color="text-blue-600" />
            <PortSection title="LAG / Trunk Ports"  ports={lagPorts}    color="text-orange-600" />
            <PortSection title="Other Ports"        ports={otherPorts}  color="text-gray-500" />
          </div>
        )}
        </div>
      </div>
    </AppLayout>
  );
}
