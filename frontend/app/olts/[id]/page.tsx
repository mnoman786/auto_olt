'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OLTStatusBadge } from '@/components/ui/Badge';
import { oltApi, vlanApi, reportsApi } from '@/lib/api';
import type { OLT, OLTStats, VLAN, AutoProvisionConfig } from '@/lib/types';
import { OLTDetailSkeleton } from '@/components/ui/Skeleton';
import {
  ArrowLeft, Server, Wifi, Network,
  RefreshCw, Play, Pencil, Trash2, CheckCircle, AlertCircle,
  Layers, PlugZap, Cpu, ChevronRight, Cloud, Wrench, Sliders, Zap, BarChart2, FileSpreadsheet,
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';

const statusDot = {
  active: 'bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.20)]',
  error: 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.20)]',
  configuring: 'bg-blue-500 animate-pulse shadow-[0_0_0_4px_rgba(59,130,246,0.20)]',
  pending: 'bg-gray-400',
  offline: 'bg-gray-400',
} as const;


export default function OLTDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [stats, setStats] = useState<OLTStats | null>(null);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [autoProvision, setAutoProvision] = useState<AutoProvisionConfig | null>(null);
  const [apEnabled, setApEnabled] = useState(false);
  const [apVlan, setApVlan] = useState<number | null>(null);
  const [apLineProfile, setApLineProfile] = useState(1);
  const [apSrvProfile, setApSrvProfile] = useState(1);
  const [savingAp, setSavingAp] = useState(false);
  const [apExpanded, setApExpanded] = useState(false);
  const [vlansExpanded, setVlansExpanded] = useState(false);
  const [profilesExpanded, setProfilesExpanded] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [syncingVlans, setSyncingVlans] = useState(false);
  const [syncingProfiles, setSyncingProfiles] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [oltRes, statsRes, vlansRes, apRes] = await Promise.all([
        oltApi.get(oltId),
        oltApi.stats(oltId),
        vlanApi.list(oltId),
        oltApi.getAutoProvision(oltId),
      ]);
      setOlt(oltRes.data);
      setStats(statsRes.data);
      setVlans(vlansRes.data.results || (vlansRes.data as any));
      const ap = apRes.data;
      setAutoProvision(ap);
      setApEnabled(ap.enabled);
      setApVlan(ap.default_vlan_id);
      setApLineProfile(ap.line_profile_id);
      setApSrvProfile(ap.srv_profile_id);
    } catch {
      toast.error('Failed to load OLT data');
    } finally {
      setFetching(false);
    }
  }, [oltId]);

  const handleSaveAutoProvision = async () => {
    if (apEnabled && apVlan === null) {
      toast.error('Please select a default VLAN before enabling auto-provisioning');
      return;
    }
    setSavingAp(true);
    try {
      const res = await oltApi.saveAutoProvision(oltId, {
        enabled: apEnabled,
        default_vlan: apVlan,
        line_profile_id: apLineProfile,
        srv_profile_id: apSrvProfile,
      });
      setAutoProvision(res.data);
      toast.success(apEnabled ? 'Auto-provisioning enabled' : 'Auto-provisioning disabled');
    } catch {
      toast.error('Failed to save auto-provisioning config');
    } finally {
      setSavingAp(false);
    }
  };

  const handleSyncProfiles = async () => {
    setSyncingProfiles(true);
    try {
      const res = await oltApi.syncProfiles(oltId);
      toast.success(
        `Found ${res.data.line_profiles.length} line profile(s) and ${res.data.srv_profiles.length} service profile(s)`
      );
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Profile sync failed');
    } finally {
      setSyncingProfiles(false);
    }
  };

  const handleSyncVlans = async () => {
    setSyncingVlans(true);
    try {
      const res = await vlanApi.sync(oltId);
      const { method, discovered, created, updated } = res.data;
      toast.success(
        `Synced via ${method.toUpperCase()}: ${discovered} on OLT • ${created} new, ${updated} updated`
      );
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'VLAN sync failed');
    } finally {
      setSyncingVlans(false);
    }
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  const handleDelete = async () => {
    if (!olt) return;
    if (!confirm(`Delete OLT "${olt.name}"? This will remove all associated ONUs and VLANs.`)) return;
    try {
      await oltApi.delete(oltId);
      toast.success(`OLT "${olt.name}" deleted`);
      router.push('/dashboard');
    } catch {
      toast.error('Failed to delete OLT');
    }
  };

  const handlePoll = async () => {
    try {
      await oltApi.poll(oltId);
      toast.success('SNMP poll started...');
      setTimeout(fetchData, 5000);
    } catch {
      toast.error('Poll failed');
    }
  };

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <OLTDetailSkeleton />
      </AppLayout>
    );
  }

  if (!olt) return null;

  const dot = statusDot[olt.status as keyof typeof statusDot] ?? statusDot.pending;

  const quickLinks = [
    { href: `/olts/${oltId}/onus`,      label: 'ONU Management',   icon: Wifi,         desc: 'View and provision ONUs',  tone: 'from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400' },
    { href: `/olts/${oltId}/ports`,     label: 'Ports & Uplinks',  icon: PlugZap,      desc: 'PON and uplink ports',     tone: 'from-purple-50 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 text-purple-600 dark:text-purple-400' },
    { href: `/olts/${oltId}/vlans`,     label: 'VLAN Management',  icon: Layers,       desc: 'Configure VLANs',          tone: 'from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-600 dark:text-emerald-400' },
    { href: `/olts/${oltId}/bandwidth`, label: 'Traffic Graphs',   icon: Cpu,          desc: 'Bandwidth monitoring',     tone: 'from-cyan-50 to-sky-100 dark:from-cyan-900/30 dark:to-sky-100/30 text-cyan-600 dark:text-cyan-400' },
    { href: `/olts/${oltId}/capacity`,  label: 'Port Capacity',    icon: BarChart2,    desc: 'PON utilization planning', tone: 'from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 text-violet-600 dark:text-violet-400' },
  ];

  return (
    <AppLayout>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-64 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />

        <div className="relative p-6 max-w-5xl mx-auto">
          {/* Back link */}
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                  <Cpu className="h-7 w-7" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${dot}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">OLT Device</p>
                <div className="flex items-center gap-3 mt-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{olt.name}</h1>
                  <OLTStatusBadge status={olt.status} />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {olt.ip_address}{olt.system_name ? ` • ${olt.system_name}` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={handlePoll}>
                Poll
              </Button>
              <Link href={`/olts/${oltId}/edit`}>
                <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />}>Edit</Button>
              </Link>
              <Link href={`/olts/${oltId}/setup`}>
                <Button variant="outline" size="sm" icon={<Play className="h-4 w-4" />}>Setup Wizard</Button>
              </Link>
              <Button
                variant="outline" size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleDelete}
                className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:hover:bg-red-900/20 dark:hover:border-red-700"
              >
                Delete
              </Button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total ONUs" value={stats.total_onus} icon={<Wifi className="h-5 w-5" />} color="blue" />
              <StatCard label="Active ONUs" value={stats.active_onus} icon={<CheckCircle className="h-5 w-5" />} color="green" />
              <StatCard label="Unregistered" value={stats.unregistered_onus} icon={<AlertCircle className="h-5 w-5" />} color={stats.unregistered_onus > 0 ? 'yellow' : 'gray'} />
              <StatCard label="Offline" value={stats.offline_onus} icon={<AlertCircle className="h-5 w-5" />} color={stats.offline_onus > 0 ? 'red' : 'gray'} />
            </div>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {quickLinks.map(item => (
              <Link key={item.href} href={item.href} className="group">
                <Card className="hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all cursor-pointer h-full">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 bg-linear-to-br ${item.tone}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Report download */}
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
              onClick={() => reportsApi.downloadExcel(oltId)}
            >
              Download Excel Report
            </Button>
          </div>

          {/* VLANs on Device */}
          <Card padding="none" className="overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => setVlansExpanded(v => !v)}
              className="w-full px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-emerald-50/40 dark:from-emerald-900/10 to-transparent flex items-center justify-between gap-3 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h2 className="font-semibold text-gray-900 dark:text-white">VLANs on Device</h2>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full shrink-0">
                  {vlans.length}
                </span>
                {vlans.some(v => v.source === 'discovered') && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 font-medium shrink-0">
                    <Cloud className="h-2.5 w-2.5" />
                    {vlans.filter(v => v.source === 'discovered').length} discovered
                  </span>
                )}
              </div>
              <ChevronRight className={clsx(
                'h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200',
                vlansExpanded && 'rotate-90',
              )} />
            </button>
            {vlansExpanded && (
              <>
                {vlans.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <Layers className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No VLANs yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click <strong>Sync</strong> to import VLANs from the OLT</p>
                  </div>
                ) : (
                  <div className="px-6 py-4 flex flex-wrap gap-2">
                    {vlans.slice(0, 24).map(v => (
                      <Link
                        key={v.id}
                        href={`/olts/${oltId}/vlans`}
                        className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                          v.source === 'discovered'
                            ? 'bg-indigo-50/60 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                            : 'bg-blue-50/60 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        }`}
                        title={v.description || v.name}
                      >
                        {v.source === 'discovered'
                          ? <Cloud className="h-3 w-3 opacity-70" />
                          : <Wrench className="h-3 w-3 opacity-70" />}
                        <span className="font-mono font-bold">{v.vlan_id}</span>
                        <span className="text-gray-500 dark:text-gray-400 group-hover:text-current truncate max-w-[10ch]">{v.name}</span>
                      </Link>
                    ))}
                    {vlans.length > 24 && (
                      <Link
                        href={`/olts/${oltId}/vlans`}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        +{vlans.length - 24} more
                      </Link>
                    )}
                  </div>
                )}
                <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RefreshCw className={`h-4 w-4 ${syncingVlans ? 'animate-spin' : ''}`} />}
                    loading={syncingVlans}
                    onClick={handleSyncVlans}
                    title="Read VLAN list from OLT"
                  >
                    Sync
                  </Button>
                  <Link href={`/olts/${oltId}/vlans`}>
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </div>
              </>
            )}
          </Card>

          {/* ONU Profiles */}
          <Card padding="none" className="overflow-hidden mb-5">
            <button
              type="button"
              onClick={() => setProfilesExpanded(v => !v)}
              className="w-full px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-purple-50/40 dark:from-purple-900/10 to-transparent flex items-center justify-between gap-3 hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sliders className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <h2 className="font-semibold text-gray-900 dark:text-white">ONU Profiles on OLT</h2>
                {(olt.line_profiles?.length || olt.srv_profiles?.length) ? (
                  <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {olt.line_profiles?.length || 0} line · {olt.srv_profiles?.length || 0} service
                  </span>
                ) : null}
              </div>
              <ChevronRight className={clsx(
                'h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200',
                profilesExpanded && 'rotate-90',
              )} />
            </button>
            {profilesExpanded && (
              <>
                {(olt.line_profiles?.length || olt.srv_profiles?.length) ? (
                  <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-600/80 dark:text-purple-400/80 mb-2">
                        Line Profiles ({olt.line_profiles?.length || 0})
                      </p>
                      {olt.line_profiles?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {olt.line_profiles.map((p, i) => (
                            <span
                              key={p.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                                i === 0
                                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                              }`}
                              title={i === 0 ? 'Default used for new ONUs' : undefined}
                            >
                              <span className="font-mono font-bold">{p.id}</span>
                              <span>{p.name}</span>
                              {i === 0 && (
                                <span className="text-[10px] uppercase tracking-wider opacity-70">default</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">None found</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-purple-600/80 dark:text-purple-400/80 mb-2">
                        Service Profiles ({olt.srv_profiles?.length || 0})
                      </p>
                      {olt.srv_profiles?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {olt.srv_profiles.map((p, i) => (
                            <span
                              key={p.id}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                                i === 0
                                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                              }`}
                              title={i === 0 ? 'Default used for new ONUs' : undefined}
                            >
                              <span className="font-mono font-bold">{p.id}</span>
                              <span>{p.name}</span>
                              {i === 0 && (
                                <span className="text-[10px] uppercase tracking-wider opacity-70">default</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">None found</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center">
                    <Sliders className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No profiles cached yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Click <strong>Sync Profiles</strong> to read available IDs from the OLT
                    </p>
                  </div>
                )}
                <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  {olt.profiles_last_synced && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Last synced {new Date(olt.profiles_last_synced).toLocaleString()}
                    </span>
                  )}
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<RefreshCw className={`h-4 w-4 ${syncingProfiles ? 'animate-spin' : ''}`} />}
                      loading={syncingProfiles}
                      onClick={handleSyncProfiles}
                      title="Re-read line + service profiles from OLT"
                    >
                      Sync Profiles
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Auto-Provisioning */}
          <Card padding="none" className="overflow-hidden mb-5">
            {/* Header — click anywhere to expand/collapse */}
            <button
              type="button"
              onClick={() => setApExpanded(v => !v)}
              className="w-full px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-amber-50/40 dark:from-amber-900/10 to-transparent flex items-center justify-between gap-3 hover:bg-amber-50/60 dark:hover:bg-amber-900/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h2 className="font-semibold text-gray-900 dark:text-white truncate">Auto-Provisioning</h2>
                <span className={clsx(
                  'hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full border shrink-0',
                  apEnabled
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600',
                )}>
                  {apEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <ChevronRight className={clsx(
                'h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200',
                apExpanded && 'rotate-90',
              )} />
            </button>

            {/* Expandable form — toggle + all settings + single Save */}
            {apExpanded && (
              <div className="px-6 py-5 space-y-5">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When enabled, newly discovered ONUs are automatically registered using the settings below — no manual action required.
                </p>

                {/* Enable / Disable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Enable zero-touch provisioning</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Runs automatically after each ONU poll</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={apEnabled}
                    onClick={() => setApEnabled(v => !v)}
                    className={clsx(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                      apEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span className={clsx(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                      apEnabled ? 'translate-x-5' : 'translate-x-0',
                    )} />
                  </button>
                </div>

                {/* Default VLAN */}
                <div className="space-y-1.5">
                  <label className={clsx(
                    'text-xs font-medium uppercase tracking-wider',
                    apEnabled && apVlan === null
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400',
                  )}>
                    Default VLAN{apEnabled && apVlan === null && ' — required when enabled'}
                  </label>
                  <select
                    value={apVlan ?? ''}
                    onChange={e => setApVlan(e.target.value ? Number(e.target.value) : null)}
                    className={clsx(
                      'w-full text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2',
                      apEnabled && apVlan === null
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                        : 'border-gray-200 dark:border-gray-600 focus:ring-amber-500',
                    )}
                  >
                    <option value="">No VLAN (untagged)</option>
                    {vlans.map(v => (
                      <option key={v.id} value={v.id}>
                        VLAN {v.vlan_id} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Profile selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Line Profile
                    </label>
                    <select
                      value={apLineProfile}
                      onChange={e => setApLineProfile(Number(e.target.value))}
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {(olt?.line_profiles?.length
                        ? olt.line_profiles
                        : [{ id: apLineProfile, name: `Profile ${apLineProfile}` }]
                      ).map(p => (
                        <option key={p.id} value={p.id}>{p.id} — {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Service Profile
                    </label>
                    <select
                      value={apSrvProfile}
                      onChange={e => setApSrvProfile(Number(e.target.value))}
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {(olt?.srv_profiles?.length
                        ? olt.srv_profiles
                        : [{ id: apSrvProfile, name: `Profile ${apSrvProfile}` }]
                      ).map(p => (
                        <option key={p.id} value={p.id}>{p.id} — {p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <Button onClick={handleSaveAutoProvision} disabled={savingAp} size="sm">
                    {savingAp ? 'Saving…' : 'Save Configuration'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* OLT Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card padding="none" className="overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-blue-50/40 dark:from-blue-900/10 to-transparent flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">OLT Configuration</h2>
              </div>
              <div className="px-6 py-4 space-y-1 text-sm">
                {[
                  ['IP Address', olt.ip_address],
                  ['SNMP Version', olt.snmp_version.toUpperCase()],
                  ['SNMP Read Community', olt.has_snmp_read_community ? 'Configured' : 'Not set'],
                  ['SNMP Write Community', olt.has_snmp_write_community ? 'Configured' : 'Not set'],
                  ['Telnet', olt.telnet_enabled ? `Enabled (port ${olt.telnet_port})` : 'Disabled'],
                  ['OLT Admin Username', olt.olt_admin_username || 'Not set'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <span className="text-gray-500 dark:text-gray-400">{k}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-500 dark:text-gray-400">OLT Admin Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-200 font-mono tracking-wider">
                      {olt.has_admin_password ? '••••••••' : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-emerald-50/40 dark:from-emerald-900/10 to-transparent flex items-center gap-2">
                <Network className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">System Information</h2>
              </div>
              <div className="px-6 py-4 space-y-1 text-sm">
                {[
                  ['System Name', olt.system_name || 'N/A'],
                  ['Uptime', olt.system_uptime || 'N/A'],
                  ['Status', olt.status],
                  ['Last Polled', olt.last_polled ? new Date(olt.last_polled).toLocaleString() : 'Never'],
                  ['Added', new Date(olt.created_at).toLocaleDateString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <span className="text-gray-500 dark:text-gray-400">{k}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-right max-w-xs truncate">{v}</span>
                  </div>
                ))}
              </div>
              {olt.system_description && (
                <div className="mx-6 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">System Description</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 break-all">{olt.system_description}</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
