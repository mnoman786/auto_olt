'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OLTStatusBadge } from '@/components/ui/Badge';
import { oltApi } from '@/lib/api';
import type { OLT, SetupLog, OLTStatus, WireGuardInfo } from '@/lib/types';
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, RefreshCw,
  Server, Play, ChevronRight, Wifi, Terminal, Shield,
  ShieldCheck, Copy, Check, Pencil
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const SETUP_STEPS = [
  { id: 'telnet_connect', label: 'Telnet Login', icon: Terminal },
  { id: 'create_user', label: 'Create Mgmt User', icon: Server },
  { id: 'configure_snmp', label: 'Configure SNMP', icon: Shield },
  { id: 'snmp_check', label: 'SNMP Read Access', icon: Shield },
  { id: 'snmp_write', label: 'SNMP Write Access', icon: Shield },
  { id: 'sys_info', label: 'System Information', icon: Server },
  { id: 'setup_complete', label: 'Setup Complete', icon: CheckCircle2 },
];

function getStepStatus(stepId: string, logs: SetupLog[]): 'pending' | 'running' | 'success' | 'error' | 'warning' | 'skipped' {
  const related = logs.filter(l => l.step === stepId || l.step.startsWith(stepId));
  if (related.length === 0) return 'pending';
  const last = related[related.length - 1];
  if (last.level === 'success') return 'success';
  if (last.level === 'error') return 'error';
  if (last.level === 'warning') return 'warning';
  return 'running';
}

function StepIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'error') return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === 'warning') return <CheckCircle2 className="h-5 w-5 text-yellow-500" />;
  if (status === 'running') return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
  if (status === 'skipped') return <ChevronRight className="h-5 w-5 text-gray-400" />;
  return <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
}

export default function OLTSetupPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [logs, setLogs] = useState<SetupLog[]>([]);
  const [oltStatus, setOltStatus] = useState<OLTStatus>('pending');
  const [setupStarted, setSetupStarted] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [polling, setPolling] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'terminal'>('setup');

  // WireGuard state (VPN OLTs only)
  const [wgInfo, setWgInfo] = useState<WireGuardInfo | null>(null);
  const [wgReady, setWgReady] = useState(false);   // true = peer configured, can proceed
  const [wgEditing, setWgEditing] = useState(false);
  const [wgForm, setWgForm] = useState({ wg_client_public_key: '', wg_client_subnet: '' });
  const [wgSaving, setWgSaving] = useState(false);
  const [wgTesting, setWgTesting] = useState(false);
  const [wgConnected, setWgConnected] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchOlt = useCallback(async () => {
    try {
      const res = await oltApi.get(oltId);
      setOlt(res.data);
      return res.data;
    } catch { return null; }
  }, [oltId]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await oltApi.getSetupLogs(oltId);
      setLogs(res.data.logs);
      setOltStatus(res.data.status);
      return res.data;
    } catch { return null; }
  }, [oltId]);

  const fetchWgInfo = useCallback(async () => {
    try {
      const res = await oltApi.getWgInfo(oltId);
      setWgInfo(res.data);
      const configured = !!res.data.client_public_key;
      setWgReady(configured);
      if (configured) {
        setWgForm({
          wg_client_public_key: res.data.client_public_key,
          wg_client_subnet: res.data.client_subnet,
        });
      }
      return res.data;
    } catch { return null; }
  }, [oltId]);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    setPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      const data = await fetchLogs();
      if (data && (data.status === 'active' || data.status === 'error')) {
        stopPolling();
        fetchOlt();
      }
    }, 2000);
  }, [fetchLogs, fetchOlt]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
  }, []);

  useEffect(() => { return () => stopPolling(); }, [stopPolling]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      setFetching(true);
      const [oltData, logsData] = await Promise.all([fetchOlt(), fetchLogs()]);

      if (oltData?.connection_type === 'vpn') {
        await fetchWgInfo();
      }

      setFetching(false);

      if (logsData) {
        const st = logsData.status;
        setOltStatus(st);
        if (st === 'configuring') {
          setSetupStarted(true);
          startPolling();
        }
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveWgPeer = async () => {
    if (!wgForm.wg_client_public_key.trim()) {
      toast.error('Public key is required');
      return;
    }
    setWgSaving(true);
    try {
      const res = await oltApi.saveWgPeer(oltId, wgForm);
      setWgInfo(res.data);
      setWgReady(true);
      setWgEditing(false);
      setWgConnected(null);
      toast.success('WireGuard peer configured');
    } catch {
      toast.error('Failed to configure WireGuard peer');
    } finally {
      setWgSaving(false);
    }
  };

  const handleTestWgPeer = async () => {
    setWgTesting(true);
    setWgConnected(null);
    try {
      const res = await oltApi.getWgInfo(oltId);
      setWgInfo(res.data);
      const connected = res.data.peer_connected;
      setWgConnected(connected);
      if (connected) {
        toast.success('WireGuard peer is connected!');
      } else {
        toast.error('Peer not connected yet — check MikroTik config');
      }
    } catch {
      toast.error('Failed to test connection');
    } finally {
      setWgTesting(false);
    }
  };

  const handleResetStatus = async () => {
    if (!confirm('Reset this OLT\'s status from "configuring" back to "pending"? Use this only when a previous setup got stuck (e.g. after a server restart).')) {
      return;
    }
    try {
      const res = await oltApi.resetStatus(oltId);
      setOltStatus(res.data.status as OLTStatus);
      setSetupStarted(false);
      stopPolling();
      toast.success('OLT status reset — you can start setup again');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Reset failed');
    }
  };

  const triggerSetup = async () => {
    try {
      await oltApi.triggerSetup(oltId);
      setSetupStarted(true);
      setOltStatus('configuring');
      setLogs([]);
      startPolling();
      toast.success('Setup started!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start setup');
    }
  };

  const levelColor: Record<string, string> = {
    info: 'text-blue-300',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const isComplete = oltStatus === 'active';
  const hasError = oltStatus === 'error';
  const isVpn = olt?.connection_type === 'vpn';
  const canStartSetup = !isVpn || wgReady;

  const runningStepIdx = (() => {
    if (!polling) return -1;
    const logSteps = new Set(logs.map(l => l.step));
    for (let i = SETUP_STEPS.length - 1; i >= 0; i--) {
      if (logSteps.has(SETUP_STEPS[i].id)) return i;
    }
    return 0;
  })();

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-64 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-5xl mx-auto">
        {/* Back link */}
        <Link href={`/olts/${oltId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to OLT
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
            <Play className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">Setup Wizard</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{olt?.name || 'OLT Setup'}</h1>
              <OLTStatusBadge status={oltStatus} />
              {oltStatus === 'configuring' && (
                <button
                  type="button"
                  onClick={handleResetStatus}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1 transition-colors"
                  title="Use if setup is stuck (e.g. server was restarted mid-setup)"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset Status
                </button>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{olt?.ip_address}</p>
          </div>
        </div>

        {/* ── WireGuard Step (VPN OLTs only) ───────────────────────────────── */}
        {isVpn && (
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className={clsx(
                  'h-5 w-5',
                  wgConnected === true ? 'text-green-500' :
                  wgConnected === false ? 'text-red-500' :
                  wgReady ? 'text-yellow-500' : 'text-gray-400'
                )} />
                Step 1 — WireGuard Peer Configuration
              </h2>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'text-xs px-2 py-1 rounded-full font-medium',
                  wgConnected === true ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  wgConnected === false ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  wgReady ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}>
                  {wgConnected === true ? 'Connected' :
                   wgConnected === false ? 'Not Connected' :
                   wgReady ? 'Configured (pending)' : 'Not Configured'}
                </span>
                {wgReady && !wgEditing && (
                  <button
                    onClick={() => setWgEditing(true)}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Server info to give customer */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Give these to customer (for MikroTik)
                  </p>
                  <Link href="/docs/wireguard" target="_blank" className="text-xs text-blue-600 hover:underline">
                    Setup Guide →
                  </Link>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Server Endpoint', value: wgInfo?.server_endpoint, key: 'ep' },
                    { label: 'Server Public Key', value: wgInfo?.server_public_key, key: 'spk' },
                    { label: 'Assigned Virtual IP', value: wgInfo?.virtual_ip ? `${wgInfo.virtual_ip}/32` : '—', key: 'vip' },
                  ].map(({ label, value, key }) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/60 rounded-lg gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                        <p className="text-xs font-mono font-medium text-gray-800 dark:text-gray-200 break-all">{value || '—'}</p>
                      </div>
                      {value && value !== '—' && (
                        <button
                          onClick={() => copyToClipboard(value, key)}
                          className="text-gray-400 hover:text-blue-600 shrink-0"
                        >
                          {copied === key
                            ? <Check className="h-4 w-4 text-green-500" />
                            : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Customer public key input */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Get these from customer
                </p>

                {wgReady && !wgEditing ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Customer Public Key</p>
                      <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all mt-0.5">
                        {wgInfo?.client_public_key}
                      </p>
                    </div>
                    {wgInfo?.client_subnet && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">LAN Subnet</p>
                        <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-0.5">{wgInfo.client_subnet}</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestWgPeer}
                      loading={wgTesting}
                      className="w-full"
                    >
                      {wgTesting ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {wgConnected === true && (
                      <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg">
                        <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          ✓ Connected — handshake confirmed.
                        </p>
                      </div>
                    )}
                    {wgConnected === false && (
                      <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                        <p className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1 font-medium">
                          <XCircle className="h-3 w-3" />
                          ✗ Not connected — check MikroTik config.
                        </p>
                      </div>
                    )}
                    {wgConnected === null && (
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg">
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                          ⏳ Peer configured but handshake not yet established.
                        </p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          Click "Test Connection" to verify the peer is connected.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Customer WireGuard Public Key <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        className="w-full text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Paste MikroTik WireGuard public key here..."
                        value={wgForm.wg_client_public_key}
                        onChange={e => setWgForm(f => ({ ...f, wg_client_public_key: e.target.value.trim() }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Customer LAN Subnet</label>
                      <input
                        className="w-full text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="192.168.1.0/24"
                        value={wgForm.wg_client_subnet}
                        onChange={e => setWgForm(f => ({ ...f, wg_client_subnet: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveWgPeer} loading={wgSaving} size="sm" className="flex-1">
                        Save & Configure Peer
                      </Button>
                      {wgEditing && (
                        <Button variant="outline" size="sm" onClick={() => setWgEditing(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                    {!wgReady && (
                      <p className="text-xs text-yellow-600">
                        ⚠ Configure WireGuard peer before starting setup.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── Setup Steps + Console ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Steps Panel */}
          <div className="space-y-3">
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-3 bg-linear-to-r from-blue-50/60 dark:from-blue-900/20 to-transparent border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-xs uppercase tracking-wider">
                  {isVpn ? 'Step 2 — OLT Setup' : 'Setup Steps'}
                </h2>
              </div>
              <div className="p-5">
              <div className="space-y-3">
                {SETUP_STEPS.map((step, idx) => {
                  const status = getStepStatus(step.id, logs);
                  const isRunning = polling && idx === runningStepIdx;
                  const effectiveStatus = (isRunning && status === 'pending') ? 'running' : status;
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <StepIcon status={effectiveStatus} />
                      <span className={clsx(
                        'text-sm',
                        effectiveStatus === 'success' ? 'text-gray-800 dark:text-gray-200 font-medium' :
                        effectiveStatus === 'error' ? 'text-red-600 dark:text-red-400 font-medium' :
                        effectiveStatus === 'running' ? 'text-blue-700 dark:text-blue-400 font-medium' :
                        'text-gray-500 dark:text-gray-400'
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                {isComplete ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Setup Complete!
                    </div>
                    <Link href={`/olts/${oltId}/onus`}>
                      <Button className="w-full" icon={<Wifi className="h-4 w-4" />} size="sm">
                        Manage ONUs
                      </Button>
                    </Link>
                  </div>
                ) : hasError ? (
                  <div className="space-y-2">
                    <p className="text-red-500 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" /> Setup failed
                    </p>
                    <Button
                      variant="outline" className="w-full"
                      icon={<RefreshCw className="h-4 w-4" />}
                      onClick={triggerSetup} size="sm"
                      disabled={!canStartSetup}
                    >
                      Retry Setup
                    </Button>
                  </div>
                ) : !setupStarted ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      icon={<Play className="h-4 w-4" />}
                      onClick={triggerSetup}
                      size="sm"
                      disabled={!canStartSetup}
                      title={!canStartSetup ? 'Configure WireGuard peer first' : undefined}
                    >
                      Start Setup
                    </Button>
                    {!canStartSetup && (
                      <p className="text-xs text-yellow-600 text-center">
                        Configure WireGuard peer above first
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-600 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setup in progress...
                  </div>
                )}
              </div>
              </div>
            </Card>

            {/* OLT Info */}
            {olt && (
              <Card padding="sm">
                <div className="space-y-2 text-sm">
                  {[
                    ['IP', olt.ip_address],
                    ['Type', olt.connection_type === 'vpn' ? 'VPN (WireGuard)' : 'Direct'],
                    ['SNMP', olt.snmp_version.toUpperCase()],
                    ['Community', olt.has_snmp_read_community ? 'Configured' : 'Not set'],
                    ['Telnet', olt.telnet_enabled ? 'Enabled' : 'Disabled'],
                    ['OLT Admin', olt.olt_admin_username || 'admin'],
                    olt.system_name && ['System', olt.system_name],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k as string} className="flex justify-between">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Log Console */}
          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('setup')}
                    className={clsx(
                      'px-3 py-1 text-xs rounded font-mono transition-colors',
                      activeTab === 'setup' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    )}
                  >
                    Setup Log
                  </button>
                  <button
                    onClick={() => setActiveTab('terminal')}
                    className={clsx(
                      'px-3 py-1 text-xs rounded font-mono transition-colors flex items-center gap-1',
                      activeTab === 'terminal' ? 'bg-green-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    )}
                  >
                    <Terminal className="h-3 w-3" /> Telnet Session
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {polling && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                      LIVE
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {activeTab === 'terminal'
                      ? `${logs.filter(l => l.step === 'telnet_terminal').length} lines`
                      : `${logs.filter(l => l.step !== 'telnet_terminal').length} entries`}
                  </span>
                </div>
              </div>

              {activeTab === 'setup' && (
                <div className="bg-gray-950 font-mono text-xs overflow-y-auto h-[480px] p-4">
                  {logs.filter(l => l.step !== 'telnet_terminal').length === 0 ? (
                    <p className="text-gray-500 italic">
                      {setupStarted ? '⟳ Initializing setup...' : '# No setup logs yet. Click "Start Setup" to begin.'}
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {logs.filter(l => l.step !== 'telnet_terminal').map((log) => (
                        <div key={log.id} className="flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded">
                          <span className="text-gray-500 shrink-0 w-20">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                          <span className={clsx('shrink-0 w-16', levelColor[log.level] || 'text-gray-400')}>
                            [{log.level.toUpperCase().padEnd(7)}]
                          </span>
                          <span className="text-gray-300 break-all">{log.message}</span>
                        </div>
                      ))}
                      {polling && (
                        <div className="flex items-center gap-2 text-gray-500 mt-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Waiting for next step...</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              )}

              {activeTab === 'terminal' && (() => {
                const termLogs = logs.filter(l => l.step === 'telnet_terminal');
                return (
                  <div className="bg-gray-950 font-mono text-xs overflow-y-auto h-[480px] p-4">
                    {termLogs.length === 0 ? (
                      <p className="text-gray-600 italic">
                        {setupStarted ? '⟳ Waiting for telnet connection...' : '# Telnet session output will appear here during setup.'}
                      </p>
                    ) : (
                      <div className="space-y-0">
                        {termLogs.map((log) => {
                          const isCmd = log.message.startsWith('> ');
                          const isAuto = log.level === 'warning';
                          return (
                            <div key={log.id} className="leading-relaxed">
                              {isCmd ? (
                                <div className="flex items-start gap-2 mt-2">
                                  <span className="text-green-400 shrink-0">$</span>
                                  <span className="text-green-300 font-bold break-all">{log.message.slice(2)}</span>
                                </div>
                              ) : isAuto ? (
                                <div className="flex items-center gap-2 mt-1 pl-4">
                                  <span className="text-yellow-400 shrink-0">⚡</span>
                                  <span className="text-yellow-300 text-[11px] italic">{log.message}</span>
                                </div>
                              ) : (
                                <pre className="text-gray-400 whitespace-pre-wrap break-all pl-4 text-[11px] leading-relaxed">
                                  {log.message}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                        {polling && (
                          <div className="flex items-center gap-1 text-green-500 mt-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                            <span className="text-gray-500">_</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                );
              })()}
            </Card>

            {isComplete && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { href: `/olts/${oltId}/onus`,  label: 'Manage ONUs',     icon: Wifi,     tone: 'from-blue-50 to-indigo-100 text-blue-600' },
                  { href: `/olts/${oltId}/ports`, label: 'Ports & Uplinks', icon: Terminal, tone: 'from-purple-50 to-fuchsia-100 text-purple-600' },
                  { href: `/olts/${oltId}/vlans`, label: 'VLANs',           icon: Server,   tone: 'from-emerald-50 to-green-100 text-emerald-600' },
                  { href: `/olts/${oltId}`,       label: 'OLT Details',     icon: Server,   tone: 'from-amber-50 to-orange-100 text-orange-600' },
                ].map(item => (
                  <Link key={item.href} href={item.href} className="group">
                    <Card padding="sm" className="hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all cursor-pointer">
                      <div className="flex flex-col items-center gap-2 py-1">
                        <div className={`p-2 rounded-lg bg-linear-to-br ${item.tone}`}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.label}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
