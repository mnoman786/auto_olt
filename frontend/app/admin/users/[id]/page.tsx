'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { OLTStatusBadge } from '@/components/ui/Badge';
import { adminApi } from '@/lib/api';
import type { AdminUserDetail, OLT } from '@/lib/types';
import {
  ArrowLeft, ShieldCheck, Server, Crown, UserCheck, UserX,
  Trash2, Loader2, Wifi, Activity, Calendar, Mail, User,
  ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

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

const oltStatusDot: Record<string, string> = {
  active: 'bg-emerald-500',
  error: 'bg-red-500',
  configuring: 'bg-blue-500 animate-pulse',
  pending: 'bg-gray-400',
  offline: 'bg-gray-400',
};

function OLTCard({ olt }: { olt: OLT }) {
  return (
    <Link
      href={`/olts/${olt.id}`}
      className="group block bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {olt.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{olt.ip_address}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={clsx('w-2 h-2 rounded-full', oltStatusDot[olt.status] ?? 'bg-gray-400')} />
          <OLTStatusBadge status={olt.status} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          {olt.connection_type === 'vpn' ? 'VPN' : 'Direct'}
        </span>
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {olt.onu_count} ONU{olt.onu_count !== 1 ? 's' : ''}
        </span>
        <span className="text-gray-400 dark:text-gray-500">{olt.snmp_version.toUpperCase()}</span>
      </div>
    </Link>
  );
}

export default function AdminUserDetailPage() {
  const { user: currentUser, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = Number(params.id);
  const isAdmin = currentUser?.is_staff || currentUser?.is_superuser;

  const [userData, setUserData] = useState<AdminUserDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
    if (!isLoading && isAuthenticated && !isAdmin) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, isAdmin, router]);

  const fetchUser = useCallback(async () => {
    setFetching(true);
    try {
      const res = await adminApi.getUser(userId);
      setUserData(res.data);
    } catch {
      toast.error('User not found');
      router.replace('/admin/users');
    } finally {
      setFetching(false);
    }
  }, [userId, router]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchUser();
  }, [isAuthenticated, isAdmin, fetchUser]);

  const handleToggleActive = async () => {
    if (!userData) return;
    setToggling(true);
    setConfirmToggle(false);
    try {
      const res = await adminApi.updateUser(userData.id, { is_active: !userData.is_active });
      setUserData(res.data);
      toast.success(`User ${!userData.is_active ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update user');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!userData) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(userData.id);
      toast.success(`${userData.username} deleted`);
      router.push('/admin/users');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete user');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const isSelf = userData?.id === currentUser?.id;

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          <span className="text-sm">Loading user…</span>
        </div>
      </AppLayout>
    );
  }

  if (!userData) return null;

  const initials = userData.username.slice(0, 2).toUpperCase();
  const displayName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || userData.username;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Back button */}
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All users
        </Link>

        {/* User profile card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Gradient header */}
          <div className="h-24 bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600" />

          <div className="px-6 pb-6">
            {/* Avatar + name row */}
            <div className="flex items-end justify-between -mt-10 mb-4 gap-4 flex-wrap">
              <div className="flex items-end gap-4">
                <div className={clsx(
                  'w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg border-4 border-white bg-linear-to-br',
                  userColor(userData.username)
                )}>
                  {initials}
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{userData.username}</h2>
                    {(userData.is_superuser || userData.is_staff) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full">
                        <Crown className="h-3 w-3" />
                        {userData.is_superuser ? 'Superuser' : 'Staff'}
                      </span>
                    )}
                    {isSelf && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full">You</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{displayName !== userData.username ? displayName : ''}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pb-1">
                {!isSelf && (
                  <>
                    {!confirmToggle ? (
                      <button
                        onClick={() => { setConfirmDelete(false); setConfirmToggle(true); }}
                        disabled={toggling}
                        className={clsx(
                          'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60',
                          userData.is_active
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        )}
                      >
                        {userData.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {userData.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                        <AlertTriangle className={clsx('h-4 w-4 shrink-0', userData.is_active ? 'text-amber-500' : 'text-emerald-500')} />
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                          {userData.is_active ? `Deactivate ${userData.username}?` : `Activate ${userData.username}?`}
                        </span>
                        <button
                          onClick={handleToggleActive}
                          disabled={toggling}
                          className={clsx(
                            'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors disabled:opacity-60',
                            userData.is_active
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          )}
                        >
                          {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmToggle(false)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {!confirmDelete ? (
                      <button
                        onClick={() => { setConfirmToggle(false); setConfirmDelete(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <span className="text-xs text-red-700 dark:text-red-400 font-medium">Delete {userData.username}?</span>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Email</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{userData.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                  {userData.is_active
                    ? <UserCheck className="h-4 w-4 text-emerald-500" />
                    : <UserX className="h-4 w-4 text-gray-400" />
                  }
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Status</p>
                  <span className={clsx(
                    'inline-block px-2 py-0.5 text-xs font-semibold rounded-full mt-0.5',
                    userData.is_active
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  )}>
                    {userData.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Joined</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {new Date(userData.date_joined).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OLT Devices section */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <Server className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">OLT Devices</h3>
            <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {userData.olts.length}
            </span>
          </div>

          {userData.olts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm py-12 text-center">
              <Server className="h-10 w-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No OLT devices yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This user hasn&apos;t added any OLTs</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userData.olts.map(olt => (
                <OLTCard key={olt.id} olt={olt} />
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
