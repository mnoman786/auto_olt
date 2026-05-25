'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { auth } from '@/lib/api';
import { User, KeyRound, ShieldCheck, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
    />
  );
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, setUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '' });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (user) {
      setProfile({
        first_name: (user as any).first_name || '',
        last_name: (user as any).last_name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setProfileErrors({});
    setSavingProfile(true);
    try {
      const res = await auth.updateProfile(profile);
      if (setUser) setUser(res.data);
      toast.success('Profile updated');
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') setProfileErrors(data);
      else toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    setSavingPassword(true);
    try {
      await auth.changePassword(passwords);
      toast.success('Password changed successfully');
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') setPasswordErrors(data);
      else toast.error('Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (isLoading) return <AppLayout><div className="p-8 animate-pulse" /></AppLayout>;

  const joinedDate = (user as any)?.created_at
    ? new Date((user as any).created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <AppLayout>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
              {(user?.username || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">Account</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{user?.username}</h1>
              <div className="flex items-center gap-3 mt-1">
                {(user as any)?.is_superuser && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" /> Superuser
                  </span>
                )}
                {(user as any)?.is_staff && !(user as any)?.is_superuser && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" /> Staff
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <Calendar className="h-3 w-3" /> Joined {joinedDate}
                </span>
              </div>
            </div>
          </div>

          {/* Profile info */}
          <Card className="mb-5">
            <div className="flex items-center gap-2 mb-5">
              <User className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Personal Information</h2>
            </div>
            <div className="space-y-4">
              <Field label="Username">
                <Input value={user?.username || ''} disabled />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name">
                  <Input
                    value={profile.first_name}
                    onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))}
                    placeholder="First name"
                  />
                </Field>
                <Field label="Last Name">
                  <Input
                    value={profile.last_name}
                    onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))}
                    placeholder="Last name"
                  />
                </Field>
              </div>
              <Field label="Email Address">
                <Input
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com"
                />
                {profileErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{profileErrors.email}</p>
                )}
              </Field>
              {profileErrors.detail && (
                <p className="text-sm text-red-600">{profileErrors.detail}</p>
              )}
              <div className="pt-1">
                <Button onClick={handleSaveProfile} loading={savingProfile}>
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>

          {/* Change password */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <KeyRound className="h-4 w-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Change Password</h2>
            </div>
            <div className="space-y-4">
              <Field label="Current Password">
                <Input
                  type="password"
                  value={passwords.current_password}
                  onChange={e => setPasswords(p => ({ ...p, current_password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                {passwordErrors.current_password && (
                  <p className="text-xs text-red-600 mt-1">{passwordErrors.current_password}</p>
                )}
              </Field>
              <Field label="New Password">
                <Input
                  type="password"
                  value={passwords.new_password}
                  onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                {passwordErrors.new_password && (
                  <p className="text-xs text-red-600 mt-1">{passwordErrors.new_password}</p>
                )}
              </Field>
              <Field label="Confirm New Password">
                <Input
                  type="password"
                  value={passwords.confirm_password}
                  onChange={e => setPasswords(p => ({ ...p, confirm_password: e.target.value }))}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                {passwordErrors.confirm_password && (
                  <p className="text-xs text-red-600 mt-1">{passwordErrors.confirm_password}</p>
                )}
              </Field>
              {passwordErrors.detail && (
                <p className="text-sm text-red-600">{passwordErrors.detail}</p>
              )}
              <div className="pt-1">
                <Button
                  onClick={handleChangePassword}
                  loading={savingPassword}
                  disabled={!passwords.current_password || !passwords.new_password || !passwords.confirm_password}
                >
                  Change Password
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
