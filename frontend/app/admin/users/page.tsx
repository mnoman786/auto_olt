'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { adminApi } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import {
  Users, Search, ShieldCheck, ChevronRight, Loader2,
  Server, ToggleLeft, ToggleRight, Trash2, RefreshCw,
  UserCheck, UserX, Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function UserRowSkeleton() {
  return (
    <div className="px-6 py-4 animate-pulse flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-36 bg-gray-100 rounded" />
        <div className="h-3 w-48 bg-gray-100 rounded" />
      </div>
      <div className="hidden md:flex items-center gap-6">
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
        <div className="h-4 w-10 bg-gray-100 rounded" />
        <div className="h-4 w-24 bg-gray-100 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

const avatarColors = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-500',
];

function userColor(username: string) {
  let n = 0;
  for (const c of username) n += c.charCodeAt(0);
  return avatarColors[n % avatarColors.length];
}

export default function AdminUsersPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.is_staff || user?.is_superuser;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
    if (!isLoading && isAuthenticated && !isAdmin) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, isAdmin, router]);

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchUsers();
  }, [isAuthenticated, isAdmin, fetchUsers]);

  const handleToggleActive = async (u: AdminUser) => {
    if (u.id === user?.id) return;
    setTogglingId(u.id);
    setConfirmToggleId(null);
    try {
      await adminApi.updateUser(u.id, { is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
      toast.success(`${u.username} ${!u.is_active ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update user');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await adminApi.deleteUser(id);
      setUsers(prev => prev.filter(x => x.id !== id));
      toast.success('User deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && u.is_active) ||
      (filter === 'inactive' && !u.is_active);
    return matchesSearch && matchesFilter;
  });

  const totalActive = users.filter(u => u.is_active).length;
  const totalInactive = users.filter(u => !u.is_active).length;
  const totalOlts = users.reduce((sum, u) => sum + u.olt_count, 0);

  if (isLoading) return <AppLayout><div className="p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
              <h1 className="text-xl font-bold text-gray-900">User Management</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 rounded-full">
                Admin
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {users.length} registered user{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', fetching && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active', value: totalActive, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Inactive', value: totalInactive, icon: UserX, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Total OLTs', value: totalOlts, icon: Server, color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', bg)}>
                <Icon className={clsx('h-5 w-5', color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            />
          </div>
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-4 py-2.5 font-medium capitalize transition-colors',
                  filter === f
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Users list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              {search || filter !== 'all' ? ' (filtered)' : ''}
            </p>
          </div>

          {fetching ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => <UserRowSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No users found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map(u => {
                const initials = (u.username).slice(0, 2).toUpperCase();
                const isSelf = u.id === user?.id;
                const isConfirmingDelete = confirmDeleteId === u.id;

                return (
                  <li key={u.id} className="px-6 py-4 hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-linear-to-br',
                        userColor(u.username)
                      )}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{u.username}</span>
                          {(u.is_superuser || u.is_staff) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
                              <Crown className="h-2.5 w-2.5" />
                              {u.is_superuser ? 'Superuser' : 'Staff'}
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded">You</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>

                      {/* Meta */}
                      <div className="hidden md:flex items-center gap-5 shrink-0">
                        <span className={clsx(
                          'px-2.5 py-1 text-xs font-semibold rounded-full',
                          u.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        )}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Server className="h-3 w-3" />
                          {u.olt_count} OLT{u.olt_count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-400 hidden lg:block">
                          {new Date(u.date_joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* View detail */}
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View details"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>

                        {/* Toggle active */}
                        {!isSelf && (
                          confirmToggleId === u.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={togglingId === u.id}
                                className={clsx(
                                  'px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60',
                                  u.is_active
                                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                )}
                              >
                                {togglingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => setConfirmToggleId(null)}
                                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setConfirmDeleteId(null); setConfirmToggleId(u.id); }}
                              disabled={togglingId === u.id}
                              title={u.is_active ? 'Deactivate user' : 'Activate user'}
                              className={clsx(
                                'p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                                u.is_active
                                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                              )}
                            >
                              {u.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            </button>
                          )
                        )}

                        {/* Delete */}
                        {!isSelf && (
                          isConfirmingDelete ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(u.id)}
                                disabled={deletingId === u.id}
                                className="px-2.5 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                              >
                                {deletingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setConfirmToggleId(null); setConfirmDeleteId(u.id); }}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
