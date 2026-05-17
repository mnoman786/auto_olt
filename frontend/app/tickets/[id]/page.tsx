'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ticketApi } from '@/lib/api';
import type { Ticket, TicketStatus } from '@/lib/types';
import {
  ArrowLeft, LifeBuoy, Clock, Server, User, Shield,
  Send, CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-100',
  answered: 'bg-green-50 text-green-700 border-green-100',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  answered: 'Answered',
  closed: 'Closed',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TicketDetailPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const ticketId = parseInt(params.id as string);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [fetching, setFetching] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isStaff = user?.is_staff || user?.is_superuser;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const load = async () => {
    try {
      const res = await ticketApi.get(ticketId);
      setTicket(res.data);
    } catch {
      toast.error('Ticket not found');
      router.push('/tickets');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (ticket) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.replies?.length]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await ticketApi.reply(ticketId, reply.trim());
      setReply('');
      await load();
      toast.success('Reply sent');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;
    setStatusLoading(true);
    try {
      const res = await ticketApi.updateStatus(ticketId, newStatus);
      setTicket(res.data);
      toast.success(`Ticket marked as ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!ticket) return null;

  const canClose = isStaff && ticket.status !== 'closed';
  const canReopen = isStaff && ticket.status === 'closed';

  return (
    <AppLayout>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 via-indigo-50/40 to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-3xl mx-auto">
          <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Support
          </Link>

          {/* Ticket header */}
          <Card className="mb-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-600 shrink-0">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs text-gray-400 font-mono">#{ticket.id}</span>
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                    STATUS_STYLES[ticket.status]
                  )}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {ticket.username}
                  </span>
                  {ticket.olt_name && (
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      {ticket.olt_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmt(ticket.created_at)}
                  </span>
                </div>
              </div>
              {/* Staff status controls */}
              {isStaff && (
                <div className="flex items-center gap-2 shrink-0">
                  {canClose && (
                    <button
                      onClick={() => handleStatusChange('closed')}
                      disabled={statusLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Close
                    </button>
                  )}
                  {canReopen && (
                    <button
                      onClick={() => handleStatusChange('open')}
                      disabled={statusLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Thread */}
          <div className="space-y-3 mb-4">
            {/* Original message */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                  {ticket.username.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-800">{ticket.username}</span>
                <span className="text-xs text-gray-400">{fmt(ticket.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
            </div>

            {/* Replies */}
            {ticket.replies.map(r => (
              <div
                key={r.id}
                className={clsx(
                  'border rounded-xl p-4',
                  r.is_staff
                    ? 'bg-indigo-50/60 border-indigo-100 ml-4'
                    : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                    r.is_staff
                      ? 'bg-linear-to-br from-indigo-500 to-purple-600'
                      : 'bg-linear-to-br from-blue-500 to-indigo-600'
                  )}>
                    {r.is_staff ? <Shield className="h-3.5 w-3.5" /> : r.author_username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{r.author_username}</span>
                  {r.is_staff && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                      Staff
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{fmt(r.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.message}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          {ticket.status !== 'closed' ? (
            <Card>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                {isStaff ? 'Reply to ticket' : 'Add reply'}
              </h3>
              <form onSubmit={handleReply} className="space-y-3">
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Write your reply..."
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  required
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={sending}
                    icon={<Send className="h-4 w-4" />}
                    disabled={!reply.trim()}
                  >
                    Send Reply
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <div className="flex items-center gap-2.5 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-gray-400" />
              This ticket is closed. {isStaff && 'You can reopen it using the button above.'}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
