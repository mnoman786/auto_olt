'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ONUStatusBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Form';
import { oltApi, onuApi, vlanApi } from '@/lib/api';
import type { OLT, ONU, VLAN } from '@/lib/types';
import {
  ArrowLeft, RefreshCw, Wifi, Signal, Clock, Play,
  CheckCircle, XCircle, AlertCircle, Loader2, Search, Filter,
  Server
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

type TabType = 'registered' | 'unregistered' | 'all';

interface RegisterModalProps {
  onu: ONU;
  oltId: number;
  vlans: VLAN[];
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterModal({ onu, oltId, vlans, onClose, onSuccess }: RegisterModalProps) {
  const [vlanId, setVlanId] = useState<string>('');
  const [description, setDescription] = useState(onu.description || '');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      await onuApi.register(oltId, onu.id, {
        vlan_id: vlanId ? parseInt(vlanId) : undefined,
        description,
      });
      toast.success(`Provisioning ONU ${onu.serial_number}...`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start provisioning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Register ONU</h3>
        <p className="text-sm text-gray-500 mb-4">Serial: <code className="bg-gray-100 px-1 rounded">{onu.serial_number}</code></p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">VLAN (optional)</label>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
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
            <label className="text-sm font-medium text-gray-700 block mb-1">Description (optional)</label>
            <input
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Customer A - Apartment 101"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-xs text-blue-700">
          The system will automatically provision this ONU using the configured method
          (SNMP / Telnet / Hybrid) without any manual CLI interaction.
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

function SignalBar({ strength }: { strength: number | null }) {
  if (strength === null) return <span className="text-gray-400 text-xs">N/A</span>;
  const dBm = strength;
  const color = dBm >= -20 ? 'text-green-500' : dBm >= -27 ? 'text-yellow-500' : 'text-red-500';
  return <span className={clsx('text-xs font-mono font-medium', color)}>{dBm.toFixed(1)} dBm</span>;
}

export default function ONUManagementPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [onus, setOnus] = useState<ONU[]>([]);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('unregistered');
  const [fetching, setFetching] = useState(true);
  const [polling, setPolling] = useState(false);
  const [search, setSearch] = useState('');
  const [registerTarget, setRegisterTarget] = useState<ONU | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [oltRes, onuRes, vlanRes] = await Promise.all([
        oltApi.get(oltId),
        onuApi.list(oltId),
        vlanApi.list(oltId),
      ]);
      setOlt(oltRes.data);
      setOnus(onuRes.data.results || (onuRes.data as any));
      setVlans(vlanRes.data.results || (vlanRes.data as any));
    } catch {
      toast.error('Failed to load ONU data');
    } finally {
      setFetching(false);
    }
  }, [oltId]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  const handlePoll = async () => {
    setPolling(true);
    try {
      await oltApi.poll(oltId);
      toast.success('SNMP poll started...');
      // Refresh data after 5 seconds
      setTimeout(fetchData, 5000);
    } catch {
      toast.error('Poll failed');
    } finally {
      setTimeout(() => setPolling(false), 5000);
    }
  };

  const filteredOnus = onus.filter(onu => {
    const matchSearch = !search ||
      onu.serial_number.toLowerCase().includes(search.toLowerCase()) ||
      onu.description.toLowerCase().includes(search.toLowerCase()) ||
      onu.pon_port.toLowerCase().includes(search.toLowerCase());

    if (activeTab === 'registered') return matchSearch && ['registered', 'active'].includes(onu.status);
    if (activeTab === 'unregistered') return matchSearch && onu.status === 'unregistered';
    return matchSearch;
  });

  const counts = {
    all: onus.length,
    registered: onus.filter(o => ['registered', 'active'].includes(o.status)).length,
    unregistered: onus.filter(o => o.status === 'unregistered').length,
  };

  if (isLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Dashboard</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">ONU Management</h1>
            <p className="text-gray-500 text-sm">{olt?.name} — {olt?.ip_address}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              icon={<RefreshCw className={clsx('h-4 w-4', polling && 'animate-spin')} />}
              onClick={handlePoll}
              loading={polling}
            >
              Poll ONUs
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
          {(['unregistered', 'registered', 'all'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ONUs
              <span className={clsx(
                'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              )}>
                {counts[tab]}
              </span>
            </button>
          ))}
          {/* OLT nav links */}
          <div className="ml-auto flex gap-2 pb-1">
            <Link href={`/olts/${oltId}/vlans`}>
              <Button variant="ghost" size="sm">VLANs</Button>
            </Link>
            <Link href={`/olts/${oltId}/setup`}>
              <Button variant="ghost" size="sm">Setup</Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by serial, description, or port..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <Card padding="none">
          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : filteredOnus.length === 0 ? (
            <div className="text-center py-16">
              <Wifi className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {activeTab === 'unregistered' ? 'No unregistered ONUs' :
                 activeTab === 'registered' ? 'No registered ONUs' : 'No ONUs found'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {activeTab === 'unregistered'
                  ? 'All ONUs are registered, or click "Poll ONUs" to discover new ones'
                  : 'Click "Poll ONUs" to discover ONUs via SNMP'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Serial Number</th>
                    <th className="px-4 py-3">PON Port</th>
                    <th className="px-4 py-3">Signal</th>
                    <th className="px-4 py-3">VLAN</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Seen</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOnus.map(onu => (
                    <tr key={onu.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <code className="font-mono text-sm text-gray-900">{onu.serial_number}</code>
                          {onu.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{onu.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {onu.pon_port || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <SignalBar strength={onu.signal_strength} />
                      </td>
                      <td className="px-4 py-3">
                        {onu.vlan_id_num ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            VLAN {onu.vlan_id_num}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ONUStatusBadge status={onu.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {onu.last_seen
                          ? new Date(onu.last_seen).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {onu.status === 'unregistered' && (
                          <Button
                            size="sm"
                            icon={<Play className="h-3.5 w-3.5" />}
                            onClick={() => setRegisterTarget(onu)}
                          >
                            Register
                          </Button>
                        )}
                        {onu.status === 'provisioning' && (
                          <span className="text-xs text-blue-600 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Provisioning...
                          </span>
                        )}
                        {['active', 'registered'].includes(onu.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await onuApi.deregister(oltId, onu.id);
                              toast.success('ONU deregistered');
                              fetchData();
                            }}
                          >
                            Deregister
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Register Modal */}
      {registerTarget && (
        <RegisterModal
          onu={registerTarget}
          oltId={oltId}
          vlans={vlans}
          onClose={() => setRegisterTarget(null)}
          onSuccess={() => {
            setRegisterTarget(null);
            setTimeout(fetchData, 3000);
          }}
        />
      )}
    </AppLayout>
  );
}
