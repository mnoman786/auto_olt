'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Form';
import { oltApi, vlanApi } from '@/lib/api';
import type { OLT, VLAN } from '@/lib/types';
import {
  ArrowLeft, Plus, Pencil, Trash2, Network, Loader2, Save, X
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
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Dashboard</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">VLAN Management</h1>
            <p className="text-gray-500 text-sm">{olt?.name} — {olt?.ip_address}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/olts/${oltId}/onus`}>
              <Button variant="outline" size="sm">ONUs</Button>
            </Link>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
              Add VLAN
            </Button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                {editTarget ? `Edit VLAN ${editTarget.vlan_id}` : 'Add New VLAN'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
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
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">VLANs</h2>
            <span className="text-sm text-gray-500">{vlans.length} configured</span>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : vlans.length === 0 ? (
            <div className="text-center py-16">
              <Network className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No VLANs configured</p>
              <p className="text-gray-400 text-sm mb-4">Add VLANs to use during ONU provisioning</p>
              <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add VLAN</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="px-6 py-3">VLAN ID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">ONUs</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vlans.map(vlan => (
                    <tr key={vlan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <span className="font-mono font-bold text-gray-900">{vlan.vlan_id}</span>
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-800">{vlan.name}</td>
                      <td className="px-6 py-3 text-gray-500">{vlan.description || '—'}</td>
                      <td className="px-6 py-3">
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                          {vlan.onu_count} ONUs
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {new Date(vlan.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
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
                            className="text-red-500 hover:bg-red-50"
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
    </AppLayout>
  );
}
