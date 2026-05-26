'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { alertsApi, oltApi } from '@/lib/api';
import type { AlertRule, AlertEvent, OLT, AlertType } from '@/lib/types';
import { Bell, Plus, Trash2, Clock, CheckCircle, XCircle, AlertTriangle, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const ALERT_LABELS: Record<AlertType, string> = {
  olt_offline: 'OLT Offline',
  olt_error: 'OLT Error',
  onu_drop: 'Mass ONU Drop',
  signal_weak: 'Weak ONU Signal',
};

const ALERT_ICONS: Record<AlertType, React.ReactNode> = {
  olt_offline: <XCircle className="h-4 w-4 text-gray-500" />,
  olt_error: <AlertTriangle className="h-4 w-4 text-red-500" />,
  onu_drop: <Wifi className="h-4 w-4 text-orange-500" />,
  signal_weak: <Wifi className="h-4 w-4 text-yellow-500" />,
};

const THRESHOLD_HINTS: Partial<Record<AlertType, string>> = {
  onu_drop: 'Fire when % of port ONUs are offline (e.g. 50)',
  signal_weak: 'Fire when Rx power drops below (dBm, e.g. -28)',
};

const DEFAULT_THRESHOLDS: Partial<Record<AlertType, number>> = {
  onu_drop: 50,
  signal_weak: -28,
};

export default function AlertsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [olts, setOlts] = useState<OLT[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New rule form state
  const [formType, setFormType] = useState<AlertType>('olt_offline');
  const [formOlt, setFormOlt] = useState<number | ''>('');
  const [formThreshold, setFormThreshold] = useState('');
  const [formCooldown, setFormCooldown] = useState(60);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = useCallback(async () => {
    try {
      const [rulesRes, eventsRes, oltsRes] = await Promise.all([
        alertsApi.getRules(),
        alertsApi.getEvents(),
        oltApi.list(),
      ]);
      setRules(rulesRes.data);
      setEvents(eventsRes.data);
      setOlts(oltsRes.data.results || (oltsRes.data as any));
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await alertsApi.createRule({
        olt: formOlt === '' ? null : Number(formOlt),
        alert_type: formType,
        channel: 'email',
        enabled: true,
        threshold: formThreshold ? Number(formThreshold) : (DEFAULT_THRESHOLDS[formType] ?? null),
        cooldown_minutes: formCooldown,
      });
      toast.success('Alert rule created');
      setShowForm(false);
      setFormType('olt_offline');
      setFormOlt('');
      setFormThreshold('');
      setFormCooldown(60);
      load();
    } catch {
      toast.error('Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AlertRule) => {
    try {
      const res = await alertsApi.updateRule(rule.id, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r.id === rule.id ? res.data : r));
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await alertsApi.deleteRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Alert Rules</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Get notified by email when something goes wrong</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(v => !v)} icon={<Plus className="h-4 w-4" />}>
            New Rule
          </Button>
        </div>

        {/* New rule form */}
        {showForm && (
          <Card className="space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Create Alert Rule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Alert Type</label>
                <select
                  value={formType}
                  onChange={e => { setFormType(e.target.value as AlertType); setFormThreshold(''); }}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(Object.keys(ALERT_LABELS) as AlertType[]).map(t => (
                    <option key={t} value={t}>{ALERT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Apply To</label>
                <select
                  value={formOlt}
                  onChange={e => setFormOlt(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All OLTs</option>
                  {olts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              {THRESHOLD_HINTS[formType] && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Threshold</label>
                  <input
                    type="number"
                    placeholder={String(DEFAULT_THRESHOLDS[formType])}
                    value={formThreshold}
                    onChange={e => setFormThreshold(e.target.value)}
                    className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500">{THRESHOLD_HINTS[formType]}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Cooldown (minutes)</label>
                <input
                  type="number"
                  min={5}
                  value={formCooldown}
                  onChange={e => setFormCooldown(Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500">Min time between repeated alerts</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? 'Saving…' : 'Create Rule'}
              </Button>
            </div>
          </Card>
        )}

        {/* Rules list */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Active Rules</h2>
            <span className="text-xs text-gray-400">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
          </div>
          {rules.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No alert rules yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click <strong>New Rule</strong> to get notified when things go wrong</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {rules.map(rule => (
                <div key={rule.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {ALERT_ICONS[rule.alert_type]}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ALERT_LABELS[rule.alert_type]}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {rule.olt_name || 'All OLTs'}
                        {rule.threshold != null && ` · threshold ${rule.threshold}`}
                        {' · '}
                        <Clock className="h-3 w-3 inline -mt-0.5" /> {rule.cooldown_minutes}m cooldown
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      onClick={() => handleToggle(rule)}
                      className={clsx(
                        'relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors focus:outline-none',
                        rule.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
                      )}
                    >
                      <span className={clsx(
                        'inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform',
                        rule.enabled ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent events */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Events</h2>
          </div>
          {events.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <CheckCircle className="h-8 w-8 text-green-300 dark:text-green-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No alerts fired yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {events.slice(0, 20).map(ev => (
                <div key={ev.id} className="px-6 py-3 flex items-start gap-3">
                  <div className="mt-0.5">{ALERT_ICONS[ev.alert_type]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                      {ALERT_LABELS[ev.alert_type]} — {ev.olt_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-wrap line-clamp-2">{ev.message}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={clsx(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded',
                      ev.sent
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500',
                    )}>
                      {ev.sent ? 'Sent' : 'Unsent'}
                    </span>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(ev.triggered_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
