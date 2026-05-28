'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Network } from 'lucide-react';
import toast from 'react-hot-toast';

const OLT_RANGES = ['1–5', '6–20', '21–50', '50+'];
const HEARD_FROM = ['WhatsApp Group', 'Facebook', 'Friend / Referral', 'Google', 'Other'];

function SelectField({ label, value, onChange, options, placeholder, error, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string; error?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    username: '', email: '', password: '', password2: '',
    company_name: '', phone: '', olt_count_range: '', heard_from: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: '' }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setForm(f => ({ ...f, phone: formatted }));
    const err = formatted ? validatePhone(formatted) : '';
    setErrors(prev => ({ ...prev, phone: err }));
  };

  // Auto-formats as user types: 0300-1234567 or +92-300-1234567
  const formatPhone = (raw: string): string => {
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');
    if (hasPlus) {
      // +92-300-1234567
      if (digits.length <= 2) return '+' + digits;
      if (digits.length <= 5) return '+' + digits.slice(0, 2) + '-' + digits.slice(2);
      return ('+' + digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5, 12));
    } else {
      // 0300-1234567
      if (digits.length <= 4) return digits;
      return digits.slice(0, 4) + '-' + digits.slice(4, 11);
    }
  };

  const validatePhone = (phone: string) => {
    if (!phone) return 'Phone number is required.';
    const hasPlus = phone.startsWith('+');
    const digits = phone.replace(/\D/g, '');
    if (hasPlus) {
      if (!digits.startsWith('92')) return 'International must start with +92 (e.g. +92-300-1234567).';
      if (digits.length !== 12) return 'International format: +92-300-1234567 (12 digits after +92).';
    } else {
      if (!digits.startsWith('0')) return 'Local numbers must start with 0 (e.g. 0300-1234567).';
      if (digits.length !== 11) return 'Local format: 0300-1234567 (11 digits total).';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) errs.phone = phoneErr;
    if (!form.olt_count_range) errs.olt_count_range = 'Please select an option.';
    if (!form.heard_from) errs.heard_from = 'Please select an option.';
    if (form.password !== form.password2) errs.password2 = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const { email, activated } = await register(
        form.username, form.email, form.password, form.password2,
        form.company_name, form.phone, form.olt_count_range, form.heard_from,
      );
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
          const e: Record<string, string> = {};
          Object.keys(data).forEach(k => { e[k] = Array.isArray(data[k]) ? data[k][0] : data[k]; });
          setErrors(e);
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

      <div className="w-full max-w-lg relative py-6">
        {/* Logo */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl mb-3 shadow-xl shadow-blue-500/30">
            <Network className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Auto OLT</h1>
          <p className="text-gray-400 text-xs mt-0.5">ISP Management System</p>
        </div>

        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl shadow-2xl ring-1 ring-white/10 dark:ring-white/5 p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Get started</p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">Create your account</h2>
          </div>

          {errors.general && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Row 1: Company + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <Input label="ISP / Company Name" type="text" placeholder="City Net ISP"
                value={form.company_name} onChange={set('company_name')} error={errors.company_name} required autoFocus maxLength={150} />
              <Input label="Phone Number" type="tel" placeholder="0300-1234567"
                value={form.phone} onChange={handlePhoneChange} error={errors.phone} required maxLength={20} />
            </div>

            {/* Row 2: OLT count + Heard from */}
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="How many OLTs do you have?" value={form.olt_count_range}
                onChange={v => setForm(f => ({ ...f, olt_count_range: v }))}
                options={OLT_RANGES} placeholder="Select range" error={errors.olt_count_range} required />
              <SelectField label="How did you hear about us?" value={form.heard_from}
                onChange={v => setForm(f => ({ ...f, heard_from: v }))}
                options={HEARD_FROM} placeholder="Select source" error={errors.heard_from} required />
            </div>

            {/* Row 3: Username + Email */}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Username" type="text" placeholder="Choose a username"
                value={form.username} onChange={set('username')} error={errors.username} required maxLength={150} />
              <Input label="Email" type="email" placeholder="your@email.com"
                value={form.email} onChange={set('email')} error={errors.email} required maxLength={254} />
            </div>

            {/* Row 4: Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Password" type="password" placeholder="At least 8 characters"
                value={form.password} onChange={set('password')} error={errors.password} required maxLength={128} />
              <Input label="Confirm Password" type="password" placeholder="Repeat password"
                value={form.password2} onChange={set('password2')} error={errors.password2} required maxLength={128} />
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign in</Link>
          </p>
        </div>

        <div className="text-center mt-3">
          <Link href="/plans" className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
            🎁 Free during beta — see what&apos;s included →
          </Link>
        </div>
        <p className="text-center text-xs text-gray-500 mt-3">
          &copy; {new Date().getFullYear()} Auto OLT &middot; Built for Pakistan local ISPs
        </p>
      </div>
    </div>
  );
}
