'use client';
import { useEffect, useState, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ONUStatusBadge } from '@/components/ui/Badge';
import { oltApi, onuApi, vlanApi, onuBulkApi } from '@/lib/api';
import type { OLT, ONU, VLAN } from '@/lib/types';
import { ONUPageSkeleton, ONUTableSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import {
  ArrowLeft, RefreshCw, Wifi, Signal, Clock, Play,
  CheckCircle, XCircle, AlertCircle, Loader2, Search,
  Server, CheckSquare, Square, Users, RotateCcw, Download, Activity
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

const RegisterModal = memo(function RegisterModal({ onu, oltId, vlans, onClose, onSuccess }: RegisterModalProps) {
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Register ONU</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Serial: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-800 dark:text-gray-200">{onu.serial_number}</code></p>

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
});

interface BulkRegisterModalProps {
  selectedOnus: ONU[];
  oltId: number;
  vlans: VLAN[];
  onClose: () => void;
  onSuccess: () => void;
}

const BulkRegisterModal = memo(function BulkRegisterModal({ selectedOnus, oltId, vlans, onClose, onSuccess }: BulkRegisterModalProps) {
  const [vlanId, setVlanId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBulkRegister = async () => {
    setLoading(true);
    try {
      const res = await onuApi.bulkRegister(oltId, {
        onu_ids: selectedOnus.map(o => o.id),
        vlan_id: vlanId ? parseInt(vlanId) : undefined,
        description: description || undefined,
      });
      const { started, skipped } = res.data;
      toast.success(`Provisioning started for ${started.length} ONU(s)${skipped.length ? `, ${skipped.length} skipped` : ''}`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Bulk registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Bulk Register ONUs</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {selectedOnus.length} ONU(s) selected for provisioning
        </p>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
          {selectedOnus.map(o => (
            <div key={o.id} className="text-xs font-mono text-gray-700 dark:text-gray-300">{o.serial_number}</div>
          ))}
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">VLAN (applied to all)</label>
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Description (applied to all, optional)</label>
            <input
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Bulk provisioned"
            />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 mb-4 text-xs text-blue-700 dark:text-blue-300">
          Each ONU will be provisioned in parallel using the configured method (SNMP / Telnet / Hybrid).
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={loading} onClick={handleBulkRegister}
            icon={<Users className="h-4 w-4" />}>
            Register {selectedOnus.length} ONUs
          </Button>
        </div>
      </div>
    </div>
  );
});

const SignalBar = memo(function SignalBar({ strength }: { strength: number | null }) {
  if (strength === null) return <span className="text-gray-400 text-xs">N/A</span>;
  const dBm = strength;
  const color = dBm >= -20 ? 'text-green-500' : dBm >= -27 ? 'text-yellow-500' : 'text-red-500';
  return <span className={clsx('text-xs font-mono font-medium', color)}>{dBm.toFixed(1)} dBm</span>;
});

export default function ONUManagementPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [onus, setOnus] = useState<ONU[]>([]);
  const [onuCount, setOnuCount] = useState(0);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('unregistered');
  const [fetching, setFetching] = useState(true);
  const [polling, setPolling] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [registerTarget, setRegisterTarget] = useState<ONU | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [rebootingIds, setRebootingIds] = useState<Set<number>>(new Set());
  const [bulkRebooting, setBulkRebooting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  // Debounce search input 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when tab or search changes
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [activeTab, debouncedSearch]);

  const fetchOnus = useCallback(async () => {
    setFetching(true);
    try {
      const params: Record<string, any> = { page };
      if (activeTab !== 'all') params.status = activeTab;
      if (debouncedSearch) params.search = debouncedSearch;
      const onuRes = await onuApi.list(oltId, params);
      setOnus(onuRes.data.results ?? []);
      setOnuCount(onuRes.data.count ?? 0);
    } catch {
      toast.error('Failed to load ONUs');
    } finally {
      setFetching(false);
    }
  }, [oltId, activeTab, debouncedSearch, page]);

  const fetchData = useCallback(async () => {
    try {
      const [oltRes, vlanRes] = await Promise.all([
        oltApi.get(oltId),
        vlanApi.list(oltId),
      ]);
      setOlt(oltRes.data);
      setVlans(vlanRes.data.results ?? (vlanRes.data as any));
    } catch {
      toast.error('Failed to load OLT data');
    }
  }, [oltId]);

  // Single mount effect — fetch OLT/VLANs and ONUs in parallel
  useEffect(() => {
    if (isAuthenticated) { Promise.all([fetchData(), fetchOnus()]); }
  }, [isAuthenticated, fetchData, fetchOnus]);

  const handleReboot = async (onu: ONU) => {
    if (!window.confirm(`Reboot ONU ${onu.serial_number}? It will be offline for ~30 seconds.`)) return;
    setRebootingIds(prev => new Set(prev).add(onu.id));
    try {
      await onuApi.reboot(oltId, onu.id);
      toast.success(`Reboot command sent to ${onu.serial_number}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Reboot failed');
    } finally {
      setRebootingIds(prev => { const s = new Set(prev); s.delete(onu.id); return s; });
    }
  };

  const handleBulkReboot = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Reboot ${selectedIds.size} ONU(s)? They will be offline for ~30 seconds.`)) return;
    setBulkRebooting(true);
    try {
      await onuBulkApi.bulkReboot(oltId, [...selectedIds]);
      toast.success(`Reboot command sent to ${selectedIds.size} ONU(s)`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Bulk reboot failed');
    } finally {
      setBulkRebooting(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    try {
      await oltApi.poll(oltId);
      toast.success('SNMP poll started...');
      setTimeout(() => Promise.all([fetchData(), fetchOnus()]), 5000);
    } catch {
      toast.error('Poll failed');
    } finally {
      setTimeout(() => setPolling(false), 5000);
    }
  };

  const unregisteredInView = onus.filter(o => o.status === 'unregistered');
  const allUnregSelected = unregisteredInView.length > 0 &&
    unregisteredInView.every(o => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allUnregSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unregisteredInView.map(o => o.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedOnus = onus.filter(o => selectedIds.has(o.id));

  // Use OLT fields for stable tab counts (not affected by current filter/search)
  const counts = {
    all: olt?.onu_count ?? 0,
    registered: olt?.registered_onu_count ?? 0,
    unregistered: (olt?.onu_count ?? 0) - (olt?.registered_onu_count ?? 0),
  };

  if (isLoading) return <AppLayout><ONUPageSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-7xl mx-auto">
        {/* Back link */}
        <Link href={`/olts/${oltId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to OLT
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <Wifi className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">Subscribers</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">ONU Management</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{olt?.name} — {olt?.ip_address}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <Button
                  size="sm"
                  icon={<Users className="h-4 w-4" />}
                  onClick={() => setShowBulkModal(true)}
                >
                  Register Selected ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={bulkRebooting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  loading={bulkRebooting}
                  onClick={handleBulkReboot}
                >
                  Reboot Selected ({selectedIds.size})
                </Button>
              </>
            )}
            <Button
              variant="outline" size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => window.open(onuBulkApi.exportCsv(oltId))}
            >
              Export CSV
            </Button>
            <Button
              variant="outline" size="sm"
              icon={<RefreshCw className={clsx('h-4 w-4', polling && 'animate-spin')} />}
              onClick={handlePoll}
              loading={polling}
            >
              Poll ONUs
            </Button>
            <Button variant="outline" size="sm" onClick={fetchOnus}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Stat summary chips */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400">
              <Wifi className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{counts.all}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-linear-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Registered</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{counts.registered}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-linear-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Unregistered</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{counts.unregistered}</p>
            </div>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="flex items-center gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          {(['unregistered', 'registered', 'all'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ONUs
              <span className={clsx(
                'ml-2 px-1.5 py-0.5 text-xs rounded-full',
                activeTab === tab ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              )}>
                {counts[tab]}
              </span>
            </button>
          ))}
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
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by serial, description, or port..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <Card padding="none" className="overflow-hidden">
          {fetching ? (
            <ONUTableSkeleton />
          ) : onus.length === 0 ? (
            <div className="text-center py-16">
              <Wifi className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {debouncedSearch ? 'No ONUs match your search' :
                 activeTab === 'unregistered' ? 'No unregistered ONUs' :
                 activeTab === 'registered' ? 'No registered ONUs' : 'No ONUs found'}
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {debouncedSearch ? 'Try a different serial number, description, or port' :
                 activeTab === 'unregistered'
                  ? 'All ONUs are registered, or click "Poll ONUs" to discover new ones'
                  : 'Click "Poll ONUs" to discover ONUs via SNMP'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                    {/* Checkbox header — only visible on unregistered tab */}
                    <th className="px-4 py-3 w-10">
                      {unregisteredInView.length > 0 && (
                        <button onClick={toggleSelectAll} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                          {allUnregSelected
                            ? <CheckSquare className="h-4 w-4 text-blue-600" />
                            : <Square className="h-4 w-4" />}
                        </button>
                      )}
                    </th>
                    <th className="px-4 py-3">Serial Number</th>
                    <th className="px-4 py-3">PON Port</th>
                    <th className="px-4 py-3">Signal</th>
                    <th className="px-4 py-3">VLAN</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Seen</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {onus.map(onu => (
                    <tr
                      key={onu.id}
                      className={clsx(
                        'hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors',
                        selectedIds.has(onu.id) && 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      )}
                    >
                      <td className="px-4 py-3">
                        {onu.status === 'unregistered' && (
                          <button onClick={() => toggleSelect(onu.id)} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            {selectedIds.has(onu.id)
                              ? <CheckSquare className="h-4 w-4 text-blue-600" />
                              : <Square className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <code className="font-mono text-sm text-gray-900 dark:text-gray-100">{onu.serial_number}</code>
                          {onu.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{onu.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {onu.pon_port || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <SignalBar strength={onu.signal_strength} />
                      </td>
                      <td className="px-4 py-3">
                        {onu.vlan_id_num ? (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                            VLAN {onu.vlan_id_num}
                          </span>
                        ) : <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ONUStatusBadge status={onu.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {onu.last_seen
                          ? new Date(onu.last_seen).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/olts/${oltId}/onus/${onu.id}/signal`}>
                            <Button size="sm" variant="ghost" icon={<Activity className="h-3.5 w-3.5" />} />
                          </Link>
                          <Link href={`/olts/${oltId}/onus/${onu.id}`}>
                            <Button size="sm" variant="outline">View</Button>
                          </Link>
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
                          {['active', 'registered', 'offline'].includes(onu.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              icon={rebootingIds.has(onu.id)
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RotateCcw className="h-3.5 w-3.5" />}
                              loading={rebootingIds.has(onu.id)}
                              onClick={() => handleReboot(onu)}
                            >
                              Reboot
                            </Button>
                          )}
                          {['active', 'registered'].includes(onu.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                await onuApi.deregister(oltId, onu.id);
                                toast.success('ONU deregistered');
                                fetchOnus();
                              }}
                            >
                              Deregister
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            count={onuCount}
            pageSize={20}
            page={page}
            onPageChange={p => { setPage(p); setSelectedIds(new Set()); }}
          />
        </Card>
        </div>
      </div>

      {/* Single Register Modal */}
      {registerTarget && (
        <RegisterModal
          onu={registerTarget}
          oltId={oltId}
          vlans={vlans}
          onClose={() => setRegisterTarget(null)}
          onSuccess={() => {
            setRegisterTarget(null);
            setTimeout(() => Promise.all([fetchData(), fetchOnus()]), 3000);
          }}
        />
      )}

      {/* Bulk Register Modal */}
      {showBulkModal && (
        <BulkRegisterModal
          selectedOnus={selectedOnus}
          oltId={oltId}
          vlans={vlans}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            setSelectedIds(new Set());
            setTimeout(() => Promise.all([fetchData(), fetchOnus()]), 3000);
          }}
        />
      )}
    </AppLayout>
  );
}
