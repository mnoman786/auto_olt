'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Form';
import { oltApi, vlanApi } from '@/lib/api';
import type { OLT, VLAN } from '@/lib/types';
import {
  ArrowLeft, Plus, Pencil, Trash2, Network, Loader2, Save, X,
  Upload, CheckCircle2, AlertCircle, RefreshCw, Cloud, Wrench
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface VLANFormData {
  vlan_id: string;
  name: string;
  description: string;
}

const defaultForm: VLANFormData = { vlan_id: '', name: '', description: '' };

export default function VLANManagementPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<VLAN | null>(null);
  const [form, setForm] = useState<VLANFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [oltRes, vlanRes] = await Promise.all([
        oltApi.get(oltId),
        vlanApi.list(oltId),
      ]);
      setOlt(oltRes.data);
      setVlans(vlanRes.data.results || (vlanRes.data as any));
    } catch {
      toast.error('Failed to load VLAN data');
    } finally {
      setFetching(false);
    }
  }, [oltId]);

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (vlan: VLAN) => {
    setEditTarget(vlan);
    setForm({ vlan_id: String(vlan.vlan_id), name: vlan.name, description: vlan.description });
    setErrors({});
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (editTarget) {
        await vlanApi.update(oltId, editTarget.id, {
          name: form.name,
          description: form.description,
        });
        toast.success(`VLAN ${editTarget.vlan_id} updated`);
      } else {
        await vlanApi.create(oltId, {
          vlan_id: parseInt(form.vlan_id),
          name: form.name,
          description: form.description,
        });
        toast.success(`VLAN ${form.vlan_id} created`);
      }
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data) {
        const errs: Record<string, string> = {};
        Object.keys(data).forEach(k => {
          errs[k] = Array.isArray(data[k]) ? data[k][0] : data[k];
        });
        setErrors(errs);
      } else {
        toast.error('Failed to save VLAN');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePush = async (vlan: VLAN) => {
    setPushingId(vlan.id);
    try {
      await vlanApi.push(oltId, vlan.id);
      toast.success(`Pushing VLAN ${vlan.vlan_id} to OLT...`);
      setTimeout(fetchData, 4000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Push failed');
    } finally {
      setTimeout(() => setPushingId(null), 4000);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
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
      setSyncing(false);
    }
  };

  const handleDelete = async (vlan: VLAN) => {
    if (!confirm(`Delete VLAN ${vlan.vlan_id} (${vlan.name})?`)) return;
    try {
      await vlanApi.delete(oltId, vlan.id);
      toast.success(`VLAN ${vlan.vlan_id} deleted`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Cannot delete VLAN');
    }
  };

  if (isLoading) return null;

  return (
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-emerald-50/70 dark:from-emerald-950/20 via-green-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-4 sm:p-6 max-w-5xl mx-auto">
        <Link href={`/olts/${oltId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to OLT
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-50 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <Network className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">Network Segmentation</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">VLAN Management</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{olt?.name} — {olt?.ip_address}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/olts/${oltId}/onus`}>
              <Button variant="outline" size="sm">ONUs</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
              loading={syncing}
              onClick={handleSync}
              title="Read all VLANs from the OLT and import them"
            >
              Sync from OLT
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add VLAN
            </Button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {editTarget ? `Edit VLAN ${editTarget.vlan_id}` : 'Add New VLAN'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Input
                  label="VLAN ID"
                  type="number"
                  placeholder="100"
                  value={form.vlan_id}
                  onChange={e => setForm(f => ({ ...f, vlan_id: e.target.value }))}
                  error={errors.vlan_id}
                  disabled={!!editTarget}
                  min={1}
                  max={4094}
                  required
                />
                <Input
                  label="Name"
                  placeholder="e.g., Management VLAN"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  error={errors.name}
                  required
                />
                <Input
                  label="Description (optional)"
                  placeholder="e.g., Customer internet"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              {errors.non_field_errors && (
                <p className="text-sm text-red-500 mb-3">{errors.non_field_errors}</p>
              )}
              <div className="flex gap-3">
                <Button type="submit" loading={saving} icon={<Save className="h-4 w-4" />}>
                  {editTarget ? 'Save Changes' : 'Create VLAN'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* VLAN List */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-linear-to-r from-emerald-50/40 dark:from-emerald-900/10 to-transparent flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">VLANs</h2>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">{vlans.length} configured</span>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : vlans.length === 0 ? (
            <div className="text-center py-16">
              <Network className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No VLANs configured</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Sync existing VLANs from the OLT, or add a new one manually</p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  icon={<RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
                  loading={syncing}
                  onClick={handleSync}
                >
                  Sync from OLT
                </Button>
                <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add VLAN</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-3">VLAN ID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Source</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">ONUs</th>
                    <th className="px-6 py-3">OLT Status</th>
                    <th className="px-6 py-3">Last Seen</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {vlans.map(vlan => (
                    <tr key={vlan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-6 py-3">
                        <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{vlan.vlan_id}</span>
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{vlan.name}</td>
                      <td className="px-6 py-3">
                        {vlan.source === 'discovered' ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 font-medium">
                            <Cloud className="h-3 w-3" /> Discovered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800 font-medium">
                            <Wrench className="h-3 w-3" /> Managed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{vlan.description || '—'}</td>
                      <td className="px-6 py-3">
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs px-2 py-0.5 rounded-full">
                          {vlan.onu_count} ONUs
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {vlan.pushed_to_olt ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Pushed
                          </span>
                        ) : vlan.push_error ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={vlan.push_error}>
                            <AlertCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Not pushed</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {vlan.last_seen_on_olt
                          ? new Date(vlan.last_seen_on_olt).toLocaleString()
                          : <span className="text-gray-400 dark:text-gray-500">Never</span>}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={pushingId === vlan.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Upload className="h-3.5 w-3.5" />}
                            onClick={() => handlePush(vlan)}
                            disabled={pushingId === vlan.id}
                            title="Push VLAN to OLT via Telnet"
                          >
                            Push
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            onClick={() => openEdit(vlan)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                            onClick={() => handleDelete(vlan)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>
      </div>
  );
}
