'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ONUStatusBadge, LogLevelBadge } from '@/components/ui/Badge';
import { oltApi, onuApi, vlanApi } from '@/lib/api';
import type { OLT, ONU, VLAN, ProvisioningLog } from '@/lib/types';
import {
  ArrowLeft, RefreshCw, Signal, Wifi, Clock, Play,
  Loader2, Server, Tag, Activity, Info, List,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function SignalStrength({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">N/A</span>;
  const color = value >= -20 ? 'text-green-600' : value >= -27 ? 'text-yellow-600' : 'text-red-600';
  return <span className={clsx('font-mono font-semibold', color)}>{value.toFixed(1)} dBm</span>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 font-medium break-all">{value ?? '—'}</span>
    </div>
  );
}

function RegisterModal({ onu, oltId, vlans, onClose, onSuccess }: {
  onu: ONU; oltId: number; vlans: VLAN[];
  onClose: () => void; onSuccess: () => void;
}) {
  const [vlanId, setVlanId] = useState('');
  const [description, setDescription] = useState(onu.description || '');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      await onuApi.register(oltId, onu.id, {
        vlan_id: vlanId ? parseInt(vlanId) : undefined,
        description,
      });
      toast.success('Provisioning started...');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start provisioning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Register ONU</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Serial: <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1 rounded">{onu.serial_number}</code>
        </p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">VLAN (optional)</label>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={vlanId}
              onChange={e => setVlanId(e.target.value)}
            >
              <option value="">No VLAN</option>
              {vlans.map(v => (
                <option key={v.id} value={v.vlan_id}>{v.name} (VLAN {v.vlan_id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Description (optional)</label>
            <input
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Customer A - Apartment 101"
            />
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 mb-4 text-xs text-blue-700 dark:text-blue-300">
          The system will automatically provision this ONU using the configured method (SNMP / Telnet / Hybrid).
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={loading} onClick={handleRegister}
            icon={<Play className="h-4 w-4" />}>
            Register ONU
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ONUDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);
  const onuId = parseInt(params.onuId as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [onu, setOnu] = useState<ONU | null>(null);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [logs, setLogs] = useState<ProvisioningLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [deregistering, setDeregistering] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [oltRes, onuRes, vlanRes, logRes] = await Promise.all([
        oltApi.get(oltId),
        onuApi.get(oltId, onuId),
        vlanApi.list(oltId),
        onuApi.getLogs(oltId, onuId),
      ]);
      setOlt(oltRes.data);
      setOnu(onuRes.data);
      setVlans(vlanRes.data.results || (vlanRes.data as any));
      setLogs(logRes.data.logs || []);
    } catch {
      toast.error('Failed to load ONU details');
    } finally {
      setFetching(false);
    }
  }, [oltId, onuId]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  const handleDeregister = async () => {
    if (!onu) return;
    setDeregistering(true);
    try {
      await onuApi.deregister(oltId, onu.id);
      toast.success('ONU deregistered');
      fetchData();
    } catch {
      toast.error('Failed to deregister ONU');
    } finally {
      setDeregistering(false);
    }
  };

  const signalLabel = onu?.signal_strength !== null && onu?.signal_strength !== undefined
    ? `${onu.signal_strength.toFixed(1)} dBm`
    : 'N/A';

  const signalColor = onu?.signal_strength !== null && onu?.signal_strength !== undefined
    ? onu.signal_strength >= -20 ? '#16a34a' : onu.signal_strength >= -27 ? '#d97706' : '#dc2626'
    : '#9ca3af';

  if (isLoading || fetching) {
    return (
        <div className="flex items-center justify-center min-h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
    );
  }

  return (
    <>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-4 sm:p-6 max-w-5xl mx-auto">
        <Link href={`/olts/${oltId}/onus`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to ONUs
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <Wifi className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">ONU Device</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono break-all">
                  {onu?.serial_number}
                </h1>
                {onu && <ONUStatusBadge status={onu.status} />}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">
                {olt?.name} — {olt?.ip_address}
                {onu?.pon_port && <span> · PON Port {onu.pon_port}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchData}
            >
              Refresh
            </Button>
            {onu?.status === 'unregistered' && (
              <Button size="sm"
                icon={<Play className="h-4 w-4" />}
                onClick={() => setShowRegister(true)}
              >
                Register
              </Button>
            )}
            {['active', 'registered'].includes(onu?.status || '') && (
              <Button size="sm" variant="danger"
                loading={deregistering}
                onClick={handleDeregister}
              >
                Deregister
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Signal Strength"
            value={signalLabel}
            icon={<Signal className="h-5 w-5" style={{ color: signalColor }} />}
          />
          <StatCard
            label="Status"
            value={onu?.status ? onu.status.charAt(0).toUpperCase() + onu.status.slice(1) : '—'}
            icon={<Activity className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="VLAN"
            value={onu?.vlan_id_num ? `VLAN ${onu.vlan_id_num}` : 'Unassigned'}
            icon={<Tag className="h-5 w-5 text-purple-500" />}
          />
          <StatCard
            label="Service Profile"
            value={onu?.service_profile || 'Default'}
            icon={<Server className="h-5 w-5 text-gray-500" />}
          />
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* ONU Information */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">ONU Information</h2>
            </div>
            <DetailRow label="Serial Number" value={
              <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-xs">{onu?.serial_number}</code>
            } />
            <DetailRow label="MAC Address" value={
              onu?.mac_address
                ? <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-xs">{onu.mac_address}</code>
                : null
            } />
            <DetailRow label="PON Port" value={
              onu?.pon_port
                ? <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-xs">{onu.pon_port}</code>
                : null
            } />
            <DetailRow label="ONU Index" value={onu?.onu_index} />
            <DetailRow label="ONU ID" value={onu?.onu_id} />
            <DetailRow label="Service Profile" value={onu?.service_profile || null} />
            <DetailRow label="Description" value={onu?.description || null} />
            <DetailRow label="VLAN" value={
              onu?.vlan_id_num
                ? <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full text-xs">
                    {onu.vlan_name ? `${onu.vlan_name} (VLAN ${onu.vlan_id_num})` : `VLAN ${onu.vlan_id_num}`}
                  </span>
                : null
            } />
          </Card>

          {/* Timestamps */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Timestamps</h2>
            </div>
            <DetailRow label="Last Seen" value={
              onu?.last_seen ? new Date(onu.last_seen).toLocaleString() : null
            } />
            <DetailRow label="Registered At" value={
              onu?.registered_at ? new Date(onu.registered_at).toLocaleString() : null
            } />
            <DetailRow label="Created At" value={
              onu?.created_at ? new Date(onu.created_at).toLocaleString() : null
            } />
            <DetailRow label="Updated At" value={
              onu?.updated_at ? new Date(onu.updated_at).toLocaleString() : null
            } />

            {/* Signal visual */}
            {onu?.signal_strength !== null && onu?.signal_strength !== undefined && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Signal Quality</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(0, Math.min(100, ((onu.signal_strength + 35) / 20) * 100))}%`,
                        backgroundColor: signalColor,
                      }}
                    />
                  </div>
                  <SignalStrength value={onu.signal_strength} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <span>Weak (-35)</span>
                  <span>Good (-15)</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Provisioning Logs */}
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-gray-50/60 dark:from-gray-800/60 to-transparent">
            <List className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Provisioning Logs</h2>
            <span className="ml-auto text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{logs.length} entries</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-center py-10">
              <Wifi className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">No provisioning logs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Step</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3 whitespace-nowrap">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-2.5">
                        <LogLevelBadge level={log.level} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{log.step}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{log.message}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>
      </div>

      {showRegister && onu && (
        <RegisterModal
          onu={onu}
          oltId={oltId}
          vlans={vlans}
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            setTimeout(fetchData, 3000);
          }}
        />
      )}
    </>
  );
}
