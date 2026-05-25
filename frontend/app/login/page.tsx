'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Network, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [throttledFor, setThrottledFor] = useState(0); // seconds remaining

  // Countdown timer when throttled
  useEffect(() => {
    if (throttledFor <= 0) return;
    const timer = setInterval(() => {
      setThrottledFor(s => {
        if (s <= 1) { clearInterval(timer); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [throttledFor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (throttledFor > 0) return;
    setErrors({});
    setLoading(true);
    try {
      await login(form.username, form.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setThrottledFor(err.retryAfter ?? 60);
      } else {
        const data = err?.response?.data;
        if (data?.non_field_errors) {
          setErrors({ general: data.non_field_errors[0] });
        } else if (data?.detail) {
          setErrors({ general: data.detail });
        } else {
          setErrors({ general: 'Login failed. Check your credentials.' });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-linear-to-br from-gray-950 via-gray-900 to-blue-950 overflow-hidden">
      {/* Decorative blobs */}
      <div aria-hidden className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.15),transparent_60%)]" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-linear-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-xl shadow-blue-500/30">
            <Network className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Auto OLT</h1>
          <p className="text-gray-400 text-sm mt-1">ISP Management System</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl ring-1 ring-white/10 p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Welcome back</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-1">Sign in to your account</h2>
          </div>

          {throttledFor > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2 text-sm text-amber-800">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Too many login attempts. Please wait{' '}
                <span className="font-bold">{throttledFor}s</span> before trying again.
              </span>
            </div>
          )}

          {errors.general && !throttledFor && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder="Enter username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              autoFocus
              disabled={throttledFor > 0}
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Password</span>
                <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                disabled={throttledFor > 0}
              />
            </div>
            <Button type="submit" loading={loading} disabled={throttledFor > 0} className="w-full" size="lg">
              {throttledFor > 0 ? `Try again in ${throttledFor}s` : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>

        <div className="text-center mt-4">
          <Link
            href="/plans"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
          >
            🎁 100% free — see everything that&apos;s included →
          </Link>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          &copy; {new Date().getFullYear()} Auto OLT &middot; Built for Pakistan local ISPs
        </p>
      </div>
    </div>
  );
}
