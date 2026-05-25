'use client';
import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/api';
import { Network, KeyRound, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';

const OTP_LENGTH = 8;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { otpRefs.current[0]?.focus(); }, []);

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
    setErrors({});
    const otpValue = otp.join('');
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required.';
    if (otpValue.length !== OTP_LENGTH) errs.otp = `Enter the complete ${OTP_LENGTH}-character OTP.`;
    if (newPassword.length < 6) errs.new_password = 'Password must be at least 6 characters.';
    if (newPassword !== confirmPassword) errs.confirm_password = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await auth.resetPassword({
        email: email.trim(),
        otp: otpValue,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else setErrors({ detail: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
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
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                    <KeyRound className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
                  <p className="text-gray-500 text-sm mt-1.5">
                    Enter the 8-character code from your email and choose a new password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email — pre-filled but editable */}
                  {!emailParam && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                    </div>
                  )}

                  {/* OTP boxes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      OTP Code
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
                          className="w-10 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-gray-50 text-gray-900 uppercase"
                          style={{ borderColor: char ? '#6366f1' : undefined }}
                        />
                      ))}
                    </div>
                    {errors.otp && <p className="text-xs text-red-600 mt-2">{errors.otp}</p>}
                  </div>

                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        className="w-full px-4 py-3 pr-11 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.new_password && <p className="text-xs text-red-600 mt-1">{errors.new_password}</p>}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.confirm_password && <p className="text-xs text-red-600 mt-1">{errors.confirm_password}</p>}
                  </div>

                  {(errors.otp || errors.detail) && (
                    <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                      {errors.otp || errors.detail}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-500">
                  Didn&apos;t get the code?{' '}
                  <Link href="/forgot-password" className="text-blue-600 font-medium hover:underline">
                    Resend OTP
                  </Link>
                </p>
              </>
            ) : (
              /* Success */
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">&#10003;</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Password reset!</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Your password has been changed successfully. You can now sign in with your new password.
                </p>
                <Link
                  href="/login"
                  className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl text-center hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  Go to Sign In
                </Link>
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
