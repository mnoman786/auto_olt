'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { customerApi } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import {
  Users, Plus, Search, X, RefreshCw, Pencil, Trash2,
  Wifi, WifiOff, Phone, MapPin, CreditCard, Upload,
  ChevronRight, UserCheck, UserX,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────
function statusDot(s: string | null) {
  if (!s) return 'bg-gray-300';
  if (s === 'active' || s === 'registered') return 'bg-green-500';
  if (s === 'offline') return 'bg-red-400';
  return 'bg-gray-400';
}

// ── skeleton ──────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 animate-pulse flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700" />
        <div className="space-y-2">
          <div className="h-3.5 w-32 bg-gray-100 dark:bg-gray-700 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 rounded-md" />
    </div>
  );
}

// ── add / edit modal ──────────────────────────────────────────────────────────
interface ModalProps {
  customer: Partial<Customer> | null;
  onClose: () => void;
  onSaved: () => void;
}

function CustomerModal({ customer, onClose, onSaved }: ModalProps) {
  const isEdit = !!customer?.id;
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    cnic: customer?.cnic ?? '',
    plan_name: customer?.plan_name ?? '',
    notes: customer?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await customerApi.update(customer!.id!, form);
        toast.success('Customer updated');
      } else {
        await customerApi.create(form);
        toast.success('Customer added');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Customer full name"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="03XX-XXXXXXX"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
              <input
                value={form.plan_name}
                onChange={e => set('plan_name', e.target.value)}
                placeholder="e.g. 10 Mbps Fiber"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNIC</label>
              <input
                value={form.cnic}
                onChange={e => set('cnic', e.target.value)}
                placeholder="XXXXX-XXXXXXX-X"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="Street, City"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Optional notes…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <Button type="submit" loading={saving} className="flex-1">
              {isEdit ? 'Save Changes' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [trigger, setTrigger] = useState(0);
  const [modal, setModal] = useState<Partial<Customer> | null | false>(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const delay = search ? 300 : 0;
    const t = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await customerApi.list({
          page: page > 1 ? page : undefined,
          search: search || undefined,
          unassigned: unassignedOnly || undefined,
        });
        if (!cancelled) {
          setCustomers(res.data.results ?? (res.data as any));
          setCount(res.data.count ?? 0);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load customers');
      } finally {
        if (!cancelled) setFetching(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isAuthenticated, page, search, unassignedOnly, trigger]);

  const refresh = () => setTrigger(t => t + 1);
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    try {
      await customerApi.delete(c.id);
      toast.success('Customer deleted');
      refresh();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await customerApi.importCsv(file);
      const { created, skipped, errors } = res.data;
      toast.success(`Imported ${created} customers${skipped ? `, ${skipped} skipped` : ''}`);
      if (errors.length) errors.forEach(err => toast.error(err, { duration: 5000 }));
      refresh();
    } catch {
      toast.error('CSV import failed');
    } finally {
      setImporting(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  };

  if (isLoading) return null;

  return (
    <div className="relative">
      <div aria-hidden className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-blue-50/60 dark:from-blue-950/20 to-transparent pointer-events-none" />
      <div className="relative p-4 sm:p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">Network</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-3">
              <Users className="h-7 w-7 text-blue-500" />
              Customers
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
              {count} subscriber{count !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" icon={<RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />} onClick={refresh} loading={fetching}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
            <Button variant="outline" icon={<Upload className="h-4 w-4" />} loading={importing} onClick={() => csvRef.current?.click()}>
              <span className="hidden sm:inline">Import CSV</span>
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({})}>
              <span className="hidden sm:inline">Add Customer</span>
            </Button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, phone, CNIC or serial…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setUnassignedOnly(v => !v); setPage(1); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              unassignedOnly
                ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <UserX className="h-4 w-4" />
            Unassigned only
          </button>
        </div>

        {/* List */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-linear-to-r from-gray-50/60 dark:from-gray-800/60 to-transparent">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Subscriber List</h2>
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
              {count} total
            </span>
          </div>

          {fetching ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {[...Array(4)].map((_, i) => <RowSkeleton key={i} />)}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-blue-500 dark:text-blue-400" />
              </div>
              {search || unassignedOnly ? (
                <>
                  <p className="text-gray-900 dark:text-white font-semibold">No results found</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try changing your search or filter.</p>
                </>
              ) : (
                <>
                  <p className="text-gray-900 dark:text-white font-semibold">No customers yet</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 mb-5">Add your first customer or import from CSV.</p>
                  <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModal({})}>Add Customer</Button>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {customers.map(c => (
                <div key={c.id} className="group px-4 sm:px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-100 to-indigo-200 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {c.phone && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{c.phone}
                          </span>
                        )}
                        {c.plan_name && (
                          <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                            {c.plan_name}
                          </span>
                        )}
                        {c.address && (
                          <span className="text-xs text-gray-400 flex items-center gap-1 truncate max-w-40 hidden sm:flex">
                            <MapPin className="h-3 w-3 shrink-0" />{c.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* ONU badge */}
                    {c.onu_serial ? (
                      <span className="hidden md:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(c.onu_status)}`} />
                        {c.onu_serial}
                      </span>
                    ) : (
                      <span className="hidden md:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
                        <UserX className="h-3 w-3" />
                        Unassigned
                      </span>
                    )}

                    <button
                      onClick={() => setModal(c)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination count={count} pageSize={20} page={page} onPageChange={setPage} />
        </Card>

        {/* CSV hint */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          CSV format: <code className="font-mono">name, phone, address, cnic, plan_name, notes, onu_serial</code>
        </p>
      </div>

      {modal !== false && (
        <CustomerModal
          customer={modal}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); refresh(); }}
        />
      )}
    </div>
  );
}
