'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { ticketApi, oltApi } from '@/lib/api';
import type { OLT } from '@/lib/types';
import { ArrowLeft, LifeBuoy, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewTicketPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [olts, setOlts] = useState<OLT[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', olt: '' });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    oltApi.list().then(res => setOlts(res.data.results ?? [])).catch(() => {});
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setLoading(true);
    try {
      const res = await ticketApi.create({
        subject: form.subject.trim(),
        message: form.message.trim(),
        olt: form.olt ? parseInt(form.olt) : null,
      });
      toast.success('Ticket submitted');
      router.push(`/tickets/${res.data.id}`);
    } catch {
      toast.error('Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  const oltOptions = [
    { value: '', label: 'No specific OLT' },
    ...olts.map(o => ({ value: String(o.id), label: o.name })),
  ];

  return (
    <AppLayout>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 via-indigo-50/40 to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-2xl mx-auto">
          <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Support
          </Link>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Submit Request</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-0.5">New Support Ticket</h1>
              <p className="text-gray-500 text-sm">Describe your issue and we'll get back to you</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Card>
              <div className="space-y-4">
                <Input
                  label="Subject"
                  placeholder="Brief description of your issue"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  required
                />
                <Select
                  label="Related OLT (optional)"
                  options={oltOptions}
                  value={form.olt}
                  onChange={e => setForm(f => ({ ...f, olt: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={6}
                    placeholder="Describe your issue in detail..."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Link href="/tickets" className="flex-1">
                <Button variant="outline" className="w-full" type="button">Cancel</Button>
              </Link>
              <Button
                type="submit"
                loading={loading}
                className="flex-1"
                size="lg"
                icon={<Send className="h-4 w-4" />}
              >
                Submit Ticket
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
