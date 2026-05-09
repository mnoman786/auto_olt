'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { oltApi } from '@/lib/api';
import { OLTCreatePayload } from '@/lib/types';
import { ArrowLeft, Server, Shield, Terminal, Info, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const SNMP_VERSIONS = [
  { value: 'v2c', label: 'SNMPv2c (recommended)' },
  { value: 'v1', label: 'SNMPv1' },
  { value: 'v3', label: 'SNMPv3' },
];

export default function AddOLTPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showTelnetPassword, setShowTelnetPassword] = useState(false);
  const [form, setForm] = useState<OLTCreatePayload>({
    name: '',
    ip_address: '',
    snmp_version: 'v2c',
    snmp_read_community: 'public',
    snmp_write_community: '',
    telnet_enabled: true,
    telnet_port: 23,
    telnet_username: 'admin',
    telnet_password: 'admin',
    olt_admin_username: 'admin',
    olt_admin_password: 'admin',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const set = (key: keyof OLTCreatePayload, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await oltApi.create(form);
      const olt = res.data;
      toast.success(`OLT "${olt.name}" created! Starting setup...`);
      // Immediately redirect to setup page
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
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add OLT Device</h1>
            <p className="text-gray-500 text-sm">Configure your OLT for automated management</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Basic Information</h2>
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
                hint="Used for Telnet login during setup."
              />
              <Input
                label="OLT Admin Password"
                type={showAdminPassword ? 'text' : 'password'}
                placeholder="Enter OLT admin password"
                value={form.olt_admin_password || ''}
                onChange={e => set('olt_admin_password', e.target.value)}
                error={errors.olt_admin_password}
                hint="Used for Telnet login during setup."
                rightAdornment={
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(v => !v)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>
          </Card>

          {/* SNMP Config */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">SNMP Configuration</h2>
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
                placeholder="public"
                value={form.snmp_read_community}
                onChange={e => set('snmp_read_community', e.target.value)}
                error={errors.snmp_read_community}
                required
              />
              <Input
                label="SNMP Write Community (optional)"
                placeholder="private"
                value={form.snmp_write_community}
                onChange={e => set('snmp_write_community', e.target.value)}
                error={errors.snmp_write_community}
                hint="Required for SNMP-based ONU provisioning"
              />
            </div>
          </Card>

          {/* Telnet Config */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Telnet / CLI Access</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Telnet is required and always enabled. Uses OLT admin credentials from Basic Information.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Telnet Port"
                  type="number"
                  value={form.telnet_port}
                  onChange={e => set('telnet_port', parseInt(e.target.value) || 23)}
                  min={1}
                  max={65535}
                />
              </div>
              <Input
                label="Telnet Username"
                value={form.telnet_username || ''}
                onChange={e => set('telnet_username', e.target.value)}
                error={errors.telnet_username}
                required
              />
              <Input
                label="Telnet Password"
                type={showTelnetPassword ? 'text' : 'password'}
                value={form.telnet_password || ''}
                onChange={e => set('telnet_password', e.target.value)}
                error={errors.telnet_password}
                required
                rightAdornment={
                  <button
                    type="button"
                    onClick={() => setShowTelnetPassword(v => !v)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label={showTelnetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showTelnetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>
          </Card>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <strong>Auto-setup:</strong> After adding the OLT, the system will automatically redirect
              you to the setup wizard where it will validate SNMP connectivity, fetch system info,
              and configure the OLT without any manual CLI interaction.
            </div>
          </div>

          {errors.non_field_errors && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
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
    </AppLayout>
  );
}
