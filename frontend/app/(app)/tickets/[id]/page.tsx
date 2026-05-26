'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
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
  open: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800',
  answered: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800',
  closed: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600',
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
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
  }

  if (!ticket) return null;

  const canClose = isStaff && ticket.status !== 'closed';
  const canReopen = isStaff && ticket.status === 'closed';

  return (
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-5xl mx-auto">
          <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Support
          </Link>

          {/* Ticket header */}
          <Card className="mb-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{ticket.id}</span>
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                    STATUS_STYLES[ticket.status]
                  )}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.subject}</h1>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
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
              {isStaff && (
                <div className="flex items-center gap-2 shrink-0">
                  {canClose && (
                    <button
                      onClick={() => handleStatusChange('closed')}
                      disabled={statusLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Close
                    </button>
                  )}
                  {canReopen && (
                    <button
                      onClick={() => handleStatusChange('open')}
                      disabled={statusLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
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
          <div className="space-y-4 mb-4">

            {/* Original message — user, right side */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 mr-1">
                <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(ticket.created_at)}</span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{ticket.username}</span>
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {ticket.username.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="max-w-[80%] bg-blue-600 dark:bg-blue-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
              </div>
            </div>

            {/* Replies */}
            {ticket.replies.map(r => (
              r.is_staff ? (
                /* Staff / admin — LEFT */
                <div key={r.id} className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-1.5 ml-1">
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                      <Shield className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{r.author_username}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-1.5 py-0.5 rounded-full">Staff</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(r.created_at)}</span>
                  </div>
                  <div className="max-w-[80%] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                  </div>
                </div>
              ) : (
                /* User — RIGHT */
                <div key={r.id} className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 mr-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(r.created_at)}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{r.author_username}</span>
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {r.author_username.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="max-w-[80%] bg-blue-600 dark:bg-blue-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.message}</p>
                  </div>
                </div>
              )
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          {ticket.status !== 'closed' ? (
            <Card>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {isStaff ? 'Reply to ticket' : 'Add reply'}
              </h3>
              <form onSubmit={handleReply} className="space-y-3">
                <textarea
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
            <div className="flex items-center gap-2.5 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-gray-400" />
              This ticket is closed. {isStaff && 'You can reopen it using the button above.'}
            </div>
          )}
        </div>
      </div>
  );
}
