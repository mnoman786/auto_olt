'use client';
import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Network, ShieldCheck, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import type { AuthResponse } from '@/lib/types';

const OTP_LENGTH = 8;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const { setUser } = useAuth();

  const [email] = useState(emailParam);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { otpRefs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown(s => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-1);
    const next = [...otp];
    next[index] = cleaned;
    setOtp(next);
    if (cleaned && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...otp];
    pasted.split('').forEach((ch, i) => { if (i < OTP_LENGTH) next[i] = ch; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otpValue = otp.join('');
    if (otpValue.length !== OTP_LENGTH) {
      setError(`Please enter the complete ${OTP_LENGTH}-character code.`);
      return;
    }
    if (!email) {
      setError('Email is missing. Please go back and register again.');
      return;
    }
    setLoading(true);
    try {
      const resp = await auth.verifyEmail({ email, otp: otpValue });
      const data: AuthResponse = resp.data;
      setTokens(data.access, data.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.otp || data?.detail || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setResending(true);
    setError('');
    try {
      await auth.resendVerification(email);
      setResendCooldown(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setError('Too many attempts. Please wait an hour before requesting a new code.');
      } else {
        setError(err?.response?.data?.detail || 'Failed to resend. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Network className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Auto OLT</span>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-950/40 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-8">
            {!success ? (
              <>
                <div className="mb-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-blue-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    We sent an 8-character code to{' '}
                    {email ? (
                      <strong className="text-gray-700">{email}</strong>
                    ) : (
                      'your email address'
                    )}
                    . Enter it below to activate your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* OTP boxes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Verification Code
                    </label>
                    <div className="flex gap-1.5 justify-between" onPaste={handleOtpPaste}>
                      {otp.map((char, i) => (
                        <input
                          key={i}
                          ref={el => { otpRefs.current[i] = el; }}
                          type="text"
                          inputMode="text"
                          maxLength={1}
                          value={char}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          disabled={loading}
                          className="w-10 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-gray-50 text-gray-900 disabled:opacity-50 uppercase"
                          style={{ borderColor: char ? '#6366f1' : undefined }}
                        />
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Verifying...' : 'Verify Account'}
                  </button>
                </form>

                {/* Resend section */}
                <div className="mt-5 text-center">
                  <p className="text-sm text-gray-500 mb-2">Didn&apos;t receive the code?</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resending}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : resending
                        ? 'Sending...'
                        : 'Resend code'}
                  </button>
                </div>
              </>
            ) : (
              /* Success state */
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Account verified!</h2>
                <p className="text-gray-500 text-sm mb-4">
                  Your account is now active. Redirecting to your dashboard&hellip;
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
