'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { mikrotikApi, oltApi } from '@/lib/api';
import type { MikroTikRouter, OLT } from '@/lib/types';
import {
  Router, Plus, Pencil, Trash2, CheckCircle2, XCircle,
  Loader2, Server, Eye, EyeOff, Link as LinkIcon, UserCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface RouterForm {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  olt_ids: number[];
}

const EMPTY_FORM: RouterForm = {
  name: '',
  host: '',
  port: 8728,
  username: 'admin',
  password: '',
  olt_ids: [],
};

export default function MikroTikPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isAdmin = user?.is_staff || user?.is_superuser;
  const router = useRouter();

  const [routers, setRouters] = useState<MikroTikRouter[]>([]);
  const [olts, setOlts] = useState<OLT[]>([]);
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MikroTikRouter | null>(null);
  const [form, setForm] = useState<RouterForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = useCallback(async () => {
    try {
      const [rRes, oRes] = await Promise.all([
        mikrotikApi.list(),
        oltApi.list(),
      ]);
      setRouters(rRes.data);
      setOlts(oRes.data.results || (oRes.data as any));
    } catch {
      toast.error('Failed to load MikroTik data');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setTestResult(null);
    setModalOpen(true);
  };

  const openEdit = (r: MikroTikRouter) => {
    setEditing(r);
    setForm({
      name: r.name,
      host: r.host,
      port: r.port,
      username: r.username,
      password: '',
      olt_ids: r.linked_olts.map(o => o.id),
    });
    setShowPassword(false);
    setTestResult(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setTestResult(null);
  };

  const set = (key: keyof RouterForm, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const toggleOlt = (id: number) => {
    setForm(f => ({
      ...f,
      olt_ids: f.olt_ids.includes(id)
        ? f.olt_ids.filter(x => x !== id)
        : [...f.olt_ids, id],
    }));
  };

  const handleTest = async () => {
    if (!form.host) { toast.error('Host is required'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      let res;
      if (editing) {
        res = await mikrotikApi.test(editing.id, {
          host: form.host,
          port: form.port,
          username: form.username,
          password: form.password || undefined,
        });
      } else {
        // For new routers, use a temp test by creating through test endpoint is not available
        // so we rely on saving first — but we can try with the unsaved credentials
        // by using an existing router's test endpoint with overridden creds if one exists,
        // or show a notice. If no routers yet, just save to test.
        if (routers.length > 0) {
          res = await mikrotikApi.test(routers[0].id, {
            host: form.host,
            port: form.port,
            username: form.username,
            password: form.password || undefined,
          });
        } else {
          toast('Save the router first, then use the Test button on the card.', { icon: 'ℹ️' });
          setTesting(false);
          return;
        }
      }
      setTestResult({ success: res.data.success, message: res.data.message });
      if (res.data.success) toast.success('MikroTik connection successful');
      else toast.error(res.data.message || 'Connection failed');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Connection test failed';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.host) {
      toast.error('Name and Host are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        host: form.host,
        port: form.port,
        username: form.username,
        olt_ids: form.olt_ids,
      };
      if (form.password) payload.password = form.password;

      if (editing) {
        const res = await mikrotikApi.update(editing.id, payload);
        setRouters(prev => prev.map(r => r.id === editing.id ? res.data : r));
        toast.success('MikroTik router updated');
      } else {
        payload.password = form.password;
        const res = await mikrotikApi.create(payload);
        setRouters(prev => [...prev, res.data]);
        toast.success('MikroTik router added');
      }
      closeModal();
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data
        ? (typeof data === 'string' ? data : Object.values(data).flat().join(', '))
        : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await mikrotikApi.delete(id);
      setRouters(prev => prev.filter(r => r.id !== id));
      toast.success('Router deleted');
    } catch {
      toast.error('Failed to delete router');
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickTest = async (r: MikroTikRouter) => {
    try {
      const res = await mikrotikApi.test(r.id);
      if (res.data.success) toast.success(`${r.name}: Connected`);
      else toast.error(`${r.name}: ${res.data.message}`);
    } catch {
      toast.error(`${r.name}: Test failed`);
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
      <div className="relative p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-cyan-50 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <Router className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Network</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">MikroTik Routers</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Manage MikroTik routers and link them to OLT devices</p>
            </div>
          </div>
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>Add Router</Button>
        </div>

        {routers.length === 0 ? (
          <Card>
            <div className="py-16 text-center">
              <Router className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No MikroTik routers yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 mb-6">Add a router and link it to your OLT devices to enable PPPoE user management.</p>
              <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>Add First Router</Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routers.map(r => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-50 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
                      <Router className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{r.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{r.host}:{r.port}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickTest(r)}
                    >
                      Test
                    </Button>
                    <button
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === r.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Linked OLTs</span>
                  </div>
                  {r.linked_olts.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">No OLTs linked</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {r.linked_olts.map(o => (
                        <span
                          key={o.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium"
                        >
                          <Server className="h-3 w-3" />
                          {o.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>API user: <span className="font-mono">{r.username}</span></span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700/50">
                      <UserCircle className="h-3 w-3" />
                      {r.owner_username}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-50 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center text-blue-600">
                  <Router className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {editing ? 'Edit MikroTik Router' : 'Add MikroTik Router'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">RouterOS API connection</p>
                </div>
              </div>

              {/* Two-column body */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">

                {/* Left — credentials */}
                <div className="space-y-4">
                  <Input
                    label="Router Name"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Main Router"
                    required
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input
                        label="Host / IP"
                        value={form.host}
                        onChange={e => set('host', e.target.value)}
                        placeholder="192.168.1.1"
                        required
                      />
                    </div>
                    <Input
                      label="Port"
                      type="number"
                      value={form.port}
                      onChange={e => set('port', parseInt(e.target.value) || 8728)}
                      min={1}
                      max={65535}
                    />
                  </div>
                  <Input
                    label="Username"
                    value={form.username}
                    onChange={e => set('username', e.target.value)}
                  />
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    hint={editing ? 'Leave blank to keep existing password' : undefined}
                    rightAdornment={
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={testing}
                      onClick={handleTest}
                      icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                    >
                      {testing ? 'Testing…' : 'Test Connection'}
                    </Button>
                    {testResult && (
                      <div className={clsx(
                        'mt-2 flex items-start gap-2 p-3 rounded-lg border text-sm',
                        testResult.success
                          ? 'bg-green-50 border-green-100 text-green-700'
                          : 'bg-red-50 border-red-100 text-red-700',
                      )}>
                        {testResult.success
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                        <span className="break-all">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right — OLT linking */}
                <div className="flex flex-col sticky top-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Link to OLTs
                    </span>
                    {form.olt_ids.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                        {form.olt_ids.length} selected
                      </span>
                    )}
                  </div>
                  {olts.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6">
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center">No OLTs available.<br />Add OLT devices first.</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto space-y-1.5 pr-1" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                      {olts.map(olt => {
                        const selected = form.olt_ids.includes(olt.id);
                        return (
                          <button
                            key={olt.id}
                            type="button"
                            onClick={() => toggleOlt(olt.id)}
                            className={clsx(
                              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all',
                              selected
                                ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:hover:bg-gray-800/50',
                            )}
                          >
                            <div className={clsx(
                              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                              selected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300 dark:border-gray-600',
                            )}>
                              {selected && (
                                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <Server className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className={clsx('text-sm font-medium truncate', selected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200')}>{olt.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">{olt.ip_address}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" className="flex-1" onClick={closeModal} type="button">
                  Cancel
                </Button>
                <Button className="flex-1" loading={saving} onClick={handleSave}>
                  {editing ? 'Save Changes' : 'Add Router'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
