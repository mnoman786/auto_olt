'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { oltApi } from '@/lib/api';
import type { OLTCreatePayload } from '@/lib/types';
import { ArrowLeft, Server, Shield, Terminal, Eye, EyeOff, Wifi, Info } from 'lucide-react';
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

export default function EditOLTPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignedVirtualIp, setAssignedVirtualIp] = useState<string | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showTelnetPassword, setShowTelnetPassword] = useState(false);
  const [form, setForm] = useState<OLTCreatePayload>({
    name: '',
    ip_address: '',
    connection_type: 'direct',
    snmp_version: 'v2c',
    snmp_read_community: randomCommunity('rd'),
    snmp_write_community: randomCommunity('wr'),
    telnet_enabled: true,
    telnet_port: 23,
    telnet_username: 'admin',
    telnet_password: '',
    olt_admin_username: 'admin',
    olt_admin_password: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchOlt = useCallback(async () => {
    try {
      const res = await oltApi.get(oltId);
      const d = res.data;
      setAssignedVirtualIp(d.vpn_virtual_ip || null);
      setForm({
        name: d.name,
        ip_address: d.ip_address,
        connection_type: d.connection_type || 'direct',
        snmp_version: d.snmp_version,
        snmp_read_community: d.snmp_read_community || randomCommunity('rd'),
        snmp_write_community: d.snmp_write_community || randomCommunity('wr'),
        telnet_enabled: true,
        telnet_port: d.telnet_port || 23,
        telnet_username: d.telnet_username || 'admin',
        telnet_password: d.telnet_password || '',
        olt_admin_username: d.olt_admin_username || 'admin',
        olt_admin_password: d.olt_admin_password || '',
      });
    } catch {
      toast.error('Failed to load OLT');
      router.push(`/olts/${oltId}`);
    } finally {
      setFetching(false);
    }
  }, [oltId, router]);

  useEffect(() => {
    if (isAuthenticated) fetchOlt();
  }, [isAuthenticated, fetchOlt]);

  const set = (key: keyof OLTCreatePayload, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await oltApi.update(oltId, form);
      toast.success('OLT updated successfully');
      router.push(`/olts/${oltId}`);
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
        toast.error('Failed to update OLT');
      }
    } finally {
      setLoading(false);
    }
  };

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
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/olts/${oltId}`}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit OLT Device</h1>
            <p className="text-gray-500 text-sm">Update OLT credentials and connectivity settings</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Basic Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="OLT Name" value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} required />
              <Input label="IP Address" value={form.ip_address} onChange={e => set('ip_address', e.target.value)} error={errors.ip_address} required />
              <Input
                label="OLT Admin Username"
                value={form.olt_admin_username || ''}
                onChange={e => set('olt_admin_username', e.target.value)}
                error={errors.olt_admin_username}
              />
              <Input
                label="OLT Admin Password"
                type={showAdminPassword ? 'text' : 'password'}
                value={form.olt_admin_password || ''}
                onChange={e => set('olt_admin_password', e.target.value)}
                error={errors.olt_admin_password}
                hint="Leave empty to keep existing password"
                rightAdornment={
                  <button type="button" onClick={() => setShowAdminPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Connection Type</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="How does this OLT connect?"
                options={CONNECTION_TYPES}
                value={form.connection_type}
                onChange={e => set('connection_type', e.target.value as any)}
                required
              />
              {form.connection_type === 'direct' ? (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>App connects directly to the public IP address above.</span>
                </div>
              ) : (
                <Input
                  label="Virtual IP (auto-assigned, read-only)"
                  value={assignedVirtualIp || 'Will be assigned on save'}
                  disabled
                  hint="Assigned by system from 10.100.0.0/16 — globally unique"
                />
              )}
            </div>
            {form.connection_type === 'vpn' && (
              <div className="flex items-start gap-2 mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-sm text-indigo-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>IP Address</strong> = OLT&apos;s real LAN IP. App connects via the auto-assigned Virtual IP through WireGuard.
                </span>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">SNMP Configuration</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="SNMP Version" options={SNMP_VERSIONS} value={form.snmp_version} onChange={e => set('snmp_version', e.target.value as any)} required />
              <Input
                label="SNMP Read Community"
                value={form.snmp_read_community}
                disabled
                hint="Fixed system value — cannot be changed"
              />
              <Input
                label="SNMP Write Community"
                value={form.snmp_write_community || ''}
                disabled
                hint="Fixed system value — cannot be changed"
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Telnet / CLI Access</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Telnet Port" type="number" value={form.telnet_port} onChange={e => set('telnet_port', parseInt(e.target.value) || 23)} min={1} max={65535} />
              <Input label="Telnet Username" value={form.telnet_username || ''} onChange={e => set('telnet_username', e.target.value)} error={errors.telnet_username} required />
              <Input
                label="Telnet Password"
                type={showTelnetPassword ? 'text' : 'password'}
                value={form.telnet_password || ''}
                onChange={e => set('telnet_password', e.target.value)}
                error={errors.telnet_password}
                hint="Leave empty to keep existing password"
                rightAdornment={
                  <button type="button" onClick={() => setShowTelnetPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showTelnetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>
          </Card>

          <div className="flex gap-3">
            <Link href={`/olts/${oltId}`} className="flex-1">
              <Button variant="outline" className="w-full" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading} className="flex-1" size="lg">
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

