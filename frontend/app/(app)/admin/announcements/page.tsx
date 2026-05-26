'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { announcementsApi } from '@/lib/api';
import type { Announcement, AnnouncementType } from '@/lib/types';
import {
  Megaphone, Plus, Trash2, ToggleLeft, ToggleRight, X, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import toast from 'react-hot-toast';

const TYPE_BADGE: Record<AnnouncementType, string> = {
  info:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  success:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const EMPTY_FORM = { title: '', message: '', type: 'info' as AnnouncementType, expires_at: '', is_dismissible: true };

export default function AnnouncementsAdminPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (!user?.is_staff && !user?.is_superuser))) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router]);

  const load = useCallback(() => {
    setLoading(true);
    announcementsApi.list()
      .then(r => setItems((r.data as any).results ?? r.data))
      .catch(() => toast.error('Failed to load announcements'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      await announcementsApi.create({
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        is_active: true,
        is_dismissible: form.is_dismissible,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      });
      toast.success('Announcement posted');
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch {
      toast.error('Failed to post announcement');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: Announcement) {
    try {
      await announcementsApi.update(a.id, { is_active: !a.is_active });
      setItems(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !a.is_active } : x));
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleDelete(id: number) {
    try {
      await announcementsApi.delete(id);
      setItems(prev => prev.filter(x => x.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  if (isLoading) return null;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-violet-50/60 dark:from-violet-950/20 to-transparent pointer-events-none"
      />
      <div className="relative p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80">
              Administration
            </p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-3">
              <Megaphone className="h-7 w-7 text-violet-500" />
              Announcements
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
              Broadcast messages to all users. Active announcements appear as banners on every page.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={load}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              variant={showForm ? 'outline' : 'primary'}
              icon={showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              onClick={() => setShowForm(v => !v)}
            >
              {showForm ? 'Cancel' : 'New Announcement'}
            </Button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">New Announcement</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                  <input
                    required
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Scheduled maintenance tonight"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value as AnnouncementType }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Expires at (optional)</label>
                    <input
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Message</label>
                <textarea
                  required
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Write the message that will appear to all users…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_dismissible}
                    onChange={e => setForm(f => ({ ...f, is_dismissible: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Allow users to dismiss this banner</span>
                </label>
                <Button type="submit" loading={saving} icon={<Megaphone className="h-4 w-4" />}>
                  Post announcement
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* List */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-linear-to-r from-gray-50/60 dark:from-gray-800/60 to-transparent">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">All Announcements</h2>
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
              {items.length} total
            </span>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Megaphone className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No announcements yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Create one to broadcast a message to all users.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map(a => (
                <div key={a.id} className="flex items-start gap-4 px-6 py-4">
                  <span className={`mt-0.5 shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_BADGE[a.type]}`}>
                    {a.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${a.is_active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <span>By {a.created_by_username ?? '—'}</span>
                      <span>·</span>
                      <span>{new Date(a.created_at).toLocaleString()}</span>
                      <span>·</span>
                      <span className={a.is_dismissible ? 'text-gray-400' : 'text-orange-500 dark:text-orange-400 font-medium'}>
                        {a.is_dismissible ? 'Dismissible' : 'Permanent'}
                      </span>
                      {a.expires_at && (
                        <>
                          <span>·</span>
                          <span>Expires {new Date(a.expires_at).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(a)}
                      title={a.is_active ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {a.is_active
                        ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                        : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      title="Delete"
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
