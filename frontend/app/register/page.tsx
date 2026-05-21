'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Network } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (form.password !== form.password2) {
      setErrors({ password2: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      const { email, activated } = await register(form.username, form.email, form.password, form.password2);
      if (activated) {
        toast.success('Account created! Welcome to Auto OLT.');
        router.push('/dashboard');
      } else {
        toast.success('Account created! Check your email for the verification code.');
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const seconds = err.retryAfter ?? 60;
        setErrors({ general: `Too many attempts. Please wait ${seconds} seconds before trying again.` });
      } else if (err?.response?.status === 403) {
        setErrors({ general: err.response.data?.detail || 'Registration is currently closed.' });
      } else {
        const data = err?.response?.data;
        if (data) {
          const errs: Record<string, string> = {};
          Object.keys(data).forEach(k => {
            errs[k] = Array.isArray(data[k]) ? data[k][0] : data[k];
          });
          setErrors(errs);
        } else {
          setErrors({ general: 'Registration failed.' });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-linear-to-br from-gray-950 via-gray-900 to-blue-950 overflow-hidden">
      <div aria-hidden className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.15),transparent_60%)]" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-linear-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-xl shadow-blue-500/30">
            <Network className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Auto OLT</h1>
          <p className="text-gray-400 text-sm mt-1">ISP Management System</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl ring-1 ring-white/10 p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Get started</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-1">Create your account</h2>
          </div>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              placeholder="Choose a username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              error={errors.username}
              required
              autoFocus
            />
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              error={errors.email}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              error={errors.password}
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat password"
              value={form.password2}
              onChange={e => setForm(f => ({ ...f, password2: e.target.value }))}
              error={errors.password2}
              required
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          &copy; {new Date().getFullYear()} Auto OLT &middot; Built for Pakistan local ISPs
        </p>
      </div>
    </div>
  );
}
