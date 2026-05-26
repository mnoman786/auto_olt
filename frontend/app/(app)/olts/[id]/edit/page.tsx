'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { oltApi } from '@/lib/api';
import type { OLTCreatePayload } from '@/lib/types';
import { ArrowLeft, Server, Terminal, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';



export default function EditOLTPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isStaff = user?.is_staff || user?.is_superuser;
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdminPassword, setShowAdminPassword] = useState(!!isStaff);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [form, setForm] = useState<OLTCreatePayload>({
    name: '',
    ip_address: '',
    connection_type: 'direct',
    snmp_version: 'v2c',
    snmp_read_community: '',
    snmp_write_community: '',
    telnet_enabled: true,
    telnet_port: 23,
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
setForm({
        name: d.name,
        ip_address: d.ip_address,
        connection_type: d.connection_type || 'direct',
        snmp_version: d.snmp_version,
        snmp_read_community: '',
        snmp_write_community: '',
        telnet_enabled: true,
        telnet_port: d.telnet_port || 23,
        olt_admin_username: d.olt_admin_username || 'admin',
        olt_admin_password: '',
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

  const handleTestConnection = async () => {
    if (!form.ip_address || !form.olt_admin_username || !form.olt_admin_password) {
      toast.error('IP, username and password are required to test');
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

  if (isLoading || fetching) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
  }

  return (
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-3xl mx-auto">
        <Link href={`/olts/${oltId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to OLT
        </Link>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center text-orange-600 shadow-sm shrink-0">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600/80">Edit Device</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Edit OLT Device</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Update OLT credentials and connectivity settings</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Basic Information</h2>
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
                hint="Clear and retype to change the password"
                rightAdornment={
                  <button type="button" onClick={() => setShowAdminPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <Input
                label="Telnet Port"
                type="number"
                value={form.telnet_port}
                onChange={e => set('telnet_port', parseInt(e.target.value) || 23)}
                min={1}
                max={65535}
                hint="Default 23 — only change if your OLT uses a non-standard telnet port"
              />
            </div>

            {form.connection_type === 'direct' && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-gray-500">
                    Test the new credentials before saving.
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
                        ? 'bg-green-50 border-green-100 text-green-700'
                        : 'bg-red-50 border-red-100 text-red-700'
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
      </div>
  );
}

