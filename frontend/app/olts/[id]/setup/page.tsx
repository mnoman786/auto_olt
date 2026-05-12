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
  FlaskConical, ShieldCheck, Copy, Check, Pencil
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const SETUP_STEPS = [
  { id: 'telnet_connect', label: 'Telnet Login', icon: Terminal },
  { id: 'create_user', label: 'Create Mgmt User', icon: Server },
  { id: 'configure_snmp', label: 'Configure SNMP', icon: Shield },
  { id: 'snmp_check', label: 'SNMP Connectivity', icon: Shield },
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
  return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
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
      const oltData = await fetchOlt();
      const logsData = await fetchLogs();

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

  const triggerSimulate = async () => {
    try {
      await oltApi.simulateSetup(oltId);
      setSetupStarted(true);
      setOltStatus('configuring');
      setLogs([]);
      startPolling();
      toast.success('Simulation started!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start simulation');
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
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">OLT Setup Wizard</h1>
              <OLTStatusBadge status={oltStatus} />
            </div>
            <p className="text-gray-500 text-sm">{olt?.name} — {olt?.ip_address}</p>
          </div>
        </div>

        {/* ── WireGuard Step (VPN OLTs only) ───────────────────────────────── */}
        {isVpn && (
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
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
                  wgConnected === true ? 'bg-green-100 text-green-700' :
                  wgConnected === false ? 'bg-red-100 text-red-700' :
                  wgReady ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
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
                    <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-xs font-mono font-medium text-gray-800 break-all">{value || '—'}</p>
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
                    <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-gray-500">Customer Public Key</p>
                      <p className="text-xs font-mono text-gray-700 break-all mt-0.5">
                        {wgInfo?.client_public_key}
                      </p>
                    </div>
                    {wgInfo?.client_subnet && (
                      <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-xs text-gray-500">LAN Subnet</p>
                        <p className="text-xs font-mono text-gray-700 mt-0.5">{wgInfo.client_subnet}</p>
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
                      <div className="p-2 bg-green-50 border border-green-100 rounded-lg">
                        <p className="text-xs text-green-700 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          ✓ Connected — handshake confirmed.
                        </p>
                      </div>
                    )}
                    {wgConnected === false && (
                      <div className="p-2 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs text-red-700 flex items-center gap-1 font-medium">
                          <XCircle className="h-3 w-3" />
                          ✗ Not connected — check MikroTik config.
                        </p>
                      </div>
                    )}
                    {wgConnected === null && (
                      <div className="p-2 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <p className="text-xs text-yellow-700 flex items-center gap-1">
                          ⏳ Peer configured but handshake not yet established.
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
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
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Paste MikroTik WireGuard public key here..."
                        value={wgForm.wg_client_public_key}
                        onChange={e => setWgForm(f => ({ ...f, wg_client_public_key: e.target.value.trim() }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Customer LAN Subnet</label>
                      <input
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <Card padding="md">
              <h2 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">
                {isVpn ? 'Step 2 — OLT Setup' : 'Setup Steps'}
              </h2>
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
                        effectiveStatus === 'success' ? 'text-gray-800 font-medium' :
                        effectiveStatus === 'error' ? 'text-red-600 font-medium' :
                        effectiveStatus === 'running' ? 'text-blue-700 font-medium' :
                        'text-gray-500'
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100">
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
                    <Button
                      variant="outline" className="w-full"
                      icon={<FlaskConical className="h-4 w-4" />}
                      onClick={triggerSimulate} size="sm"
                    >
                      Simulate Instead
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
                    <Button
                      variant="outline" className="w-full"
                      icon={<FlaskConical className="h-4 w-4" />}
                      onClick={triggerSimulate} size="sm"
                    >
                      Simulate Setup
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
            </Card>

            {/* OLT Info */}
            {olt && (
              <Card padding="sm">
                <div className="space-y-2 text-sm">
                  {[
                    ['IP', olt.ip_address],
                    ['Type', olt.connection_type === 'vpn' ? 'VPN (WireGuard)' : 'Direct'],
                    ['SNMP', olt.snmp_version.toUpperCase()],
                    ['Community', olt.snmp_read_community],
                    ['Telnet', olt.telnet_enabled ? 'Enabled' : 'Disabled'],
                    ['OLT Admin', olt.olt_admin_username || 'admin'],
                    olt.system_name && ['System', olt.system_name],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k as string} className="flex justify-between">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium text-gray-800 text-right">{v}</span>
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
                    <p className="text-gray-600 italic">
                      {setupStarted ? '⟳ Initializing setup...' : '# No setup logs yet. Click "Start Setup" to begin.'}
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {logs.filter(l => l.step !== 'telnet_terminal').map((log) => (
                        <div key={log.id} className="flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded">
                          <span className="text-gray-600 shrink-0 w-20">
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
              <div className="mt-4 grid grid-cols-4 gap-3">
                {[
                  { href: `/olts/${oltId}/onus`, label: 'Manage ONUs', icon: Wifi },
                  { href: `/olts/${oltId}/ports`, label: 'Ports & Uplinks', icon: Terminal },
                  { href: `/olts/${oltId}/vlans`, label: 'VLANs', icon: Server },
                  { href: `/olts/${oltId}`, label: 'OLT Details', icon: Server },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <Card padding="sm" className="hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer">
                      <div className="flex flex-col items-center gap-2 py-1">
                        <item.icon className="h-5 w-5 text-blue-600" />
                        <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
