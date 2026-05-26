  'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { oltApi } from '@/lib/api';
import { OLTCreatePayload } from '@/lib/types';
import { ArrowLeft, Server, Shield, Terminal, Info, Eye, EyeOff, Wifi, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const SNMP_VERSIONS = [
  { value: 'v2c', label: 'SNMPv2c (recommended)' },
  { value: 'v1', label: 'SNMPv1' },
  { value: 'v3', label: 'SNMPv3' },
];

const CONNECTION_TYPES = [
  { value: 'direct', label: 'Direct (Public IP)' },
  { value: 'vpn', label: 'VPN (WireGuard)' },
];

function randomCommunity(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const rand = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}_${rand}`;
}

export default function AddOLTPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [form, setForm] = useState<OLTCreatePayload>({
    name: '',
    ip_address: '',
    connection_type: 'direct',
    snmp_version: 'v2c',
    snmp_read_community: randomCommunity('rd'),
    snmp_write_community: randomCommunity('wr'),
    telnet_enabled: true,
    telnet_port: 23,
    olt_admin_username: 'admin',
    olt_admin_password: 'admin',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const set = (key: keyof OLTCreatePayload, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleTestConnection = async () => {
    if (!form.ip_address) {
      toast.error('Enter the IP address first');
      return;
    }
    if (!form.olt_admin_username || !form.olt_admin_password) {
      toast.error('Enter the OLT admin username and password first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await oltApi.testConnection({
        ip_address: form.ip_address,
        telnet_port: form.telnet_port,
        olt_admin_username: form.olt_admin_username,
        olt_admin_password: form.olt_admin_password,
      });
      setTestResult({ success: res.data.success, message: res.data.message });
      if (res.data.success) {
        toast.success('Telnet login successful');
      } else {
        toast.error(res.data.message || 'Connection failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Connection test failed';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await oltApi.create(form);
      const olt = res.data;
      toast.success(`OLT "${olt.name}" created! Starting setup...`);
      router.push(`/olts/${olt.id}/setup`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data) {
        const errs: Record<string, string> = {};
        Object.keys(data).forEach(k => {
          errs[k] = Array.isArray(data[k]) ? data[k][0] : data[k];
        });
        setErrors(errs);
        toast.error('Please fix the errors below');
      } else {
        toast.error('Failed to create OLT');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-3xl mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">New Device</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Add OLT Device</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Configure your OLT for automated management</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Info */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Basic Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="OLT Name"
                  placeholder="e.g., Main Office OLT-01"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  error={errors.name}
                  required
                />
                <Input
                  label="IP Address"
                  placeholder="192.168.1.1"
                  value={form.ip_address}
                  onChange={e => set('ip_address', e.target.value)}
                  error={errors.ip_address}
                  required
                />
                <Input
                  label="OLT Admin Username"
                  placeholder="admin"
                  value={form.olt_admin_username || ''}
                  onChange={e => set('olt_admin_username', e.target.value)}
                  error={errors.olt_admin_username}
                  required
                />
                <Input
                  label="OLT Admin Password"
                  type={showAdminPassword ? 'text' : 'password'}
                  placeholder="Enter OLT admin password"
                  value={form.olt_admin_password || ''}
                  onChange={e => set('olt_admin_password', e.target.value)}
                  error={errors.olt_admin_password}
                  required
                  rightAdornment={
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(v => !v)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Input
                  label="Telnet Port"
                  type="number"
                  placeholder="23"
                  value={form.telnet_port}
                  onChange={e => set('telnet_port', parseInt(e.target.value) || 23)}
                  min={1}
                  max={65535}
                  hint="Default 23 — only change if your OLT uses a non-standard telnet port"
                />
              </div>

              {form.connection_type === 'direct' && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Verify these credentials work before saving — avoids burning login attempts during full setup.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={testing}
                      onClick={handleTestConnection}
                      icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                    >
                      {testing ? 'Testing…' : 'Test Connection'}
                    </Button>
                  </div>
                  {testResult && (
                    <div
                      className={`mt-3 flex items-start gap-2 p-3 rounded-lg border text-sm ${
                        testResult.success
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-700 dark:text-green-400'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {testResult.success
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <span className="wrap-break-word">{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Connection Type */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Wifi className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Connection Type</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {CONNECTION_TYPES.map(opt => {
                  const active = form.connection_type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('connection_type', opt.value as any)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        active
                          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20 ring-2 ring-indigo-100 dark:ring-indigo-900/40'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          active ? 'border-indigo-500' : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {active && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </div>
                        <span className={`text-sm font-medium ${active ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {opt.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {form.connection_type === 'direct' ? (
                <div className="flex items-start gap-2.5 p-3.5 bg-blue-50/60 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
                  <p className="leading-relaxed">
                    App will connect directly to the IP address above. Best when the OLT has a public IP or is on the same network as this server.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-indigo-100 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10 divide-y divide-indigo-100/70 dark:divide-indigo-800/50">
                  <div className="flex items-start gap-2.5 p-3.5 text-sm text-indigo-800 dark:text-indigo-300">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-500 dark:text-indigo-400" />
                    <p className="leading-relaxed">
                      A unique virtual IP from <strong className="font-semibold">10.100.0.0/16</strong> will be auto-assigned. Set the <strong className="font-semibold">IP Address</strong> field above to the OLT&apos;s real LAN IP (e.g. <code className="font-mono text-xs bg-white/60 dark:bg-gray-800/60 px-1 py-0.5 rounded">192.168.1.1</code>).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 p-3.5 text-sm text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-900/10">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                    <p className="leading-relaxed">
                      After saving, the Setup Wizard will ask for the customer&apos;s WireGuard public key before continuing.
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* SNMP Config */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">SNMP Configuration</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="SNMP Version"
                  options={SNMP_VERSIONS}
                  value={form.snmp_version}
                  onChange={e => set('snmp_version', e.target.value as any)}
                  required
                />
                <Input
                  label="SNMP Read Community"
                  value={form.snmp_read_community}
                  disabled
                  hint="Fixed system value — cannot be changed"
                />
                <Input
                  label="SNMP Write Community"
                  value={form.snmp_write_community}
                  disabled
                  hint="Fixed system value — cannot be changed"
                />
              </div>
            </Card>

            {/* Info box */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Auto-setup:</strong> After adding the OLT, the system will automatically redirect
                you to the setup wizard where it will validate SNMP connectivity, fetch system info,
                and configure the OLT without any manual CLI interaction.
              </div>
            </div>

            {errors.non_field_errors && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {errors.non_field_errors}
              </div>
            )}

            <div className="flex gap-3">
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full" type="button">Cancel</Button>
              </Link>
              <Button type="submit" loading={loading} className="flex-1" size="lg">
                Add OLT & Start Setup
              </Button>
            </div>
          </form>
        </div>
      </div>
  );
}
