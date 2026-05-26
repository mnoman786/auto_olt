'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { ticketApi } from '@/lib/api';
import type { TicketListItem, TicketStatus } from '@/lib/types';
import { LifeBuoy, Plus, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TicketsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [ticketCount, setTicketCount] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const isStaff = user?.is_staff || user?.is_superuser;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => { setPage(1); }, [filter]);

  const fetchTickets = useCallback(async () => {
    if (!isAuthenticated) return;
    setFetching(true);
    try {
      const params: Record<string, any> = { page };
      if (filter !== 'all') params.status = filter;
      const res = await ticketApi.list(params);
      setTickets(res.data.results ?? []);
      setTicketCount(res.data.count ?? 0);
    } finally {
      setFetching(false);
    }
  }, [isAuthenticated, filter, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return (
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none"
        />
        <div className="relative p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">
                  {isStaff ? 'All Users' : 'My'} Tickets
                </p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Support</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {isStaff ? 'View and reply to all support requests' : 'Submit and track your support requests'}
                </p>
              </div>
            </div>
            <Link href="/tickets/new">
              <Button icon={<Plus className="h-4 w-4" />}>New Ticket</Button>
            </Link>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            {(['all', 'open', 'answered', 'closed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  filter === s
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
                {filter === s && (
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{ticketCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Ticket list */}
          {fetching ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <Card>
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <LifeBuoy className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No tickets found</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {filter !== 'all' ? 'Try a different filter.' : 'Open a new ticket if you need help.'}
                </p>
                {filter === 'all' && (
                  <Link href="/tickets/new" className="mt-2">
                    <Button size="sm" icon={<Plus className="h-4 w-4" />}>New Ticket</Button>
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {tickets.map(ticket => (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 flex items-center gap-4 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all group">
                      <div className="shrink-0">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          STATUS_STYLES[ticket.status]
                        )}>
                          {STATUS_LABELS[ticket.status]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          #{ticket.id} — {ticket.subject}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          {isStaff && (
                            <span className="font-medium text-gray-500 dark:text-gray-400">{ticket.username}</span>
                          )}
                          {ticket.olt_name && (
                            <span>OLT: {ticket.olt_name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(ticket.created_at)}
                          </span>
                          {ticket.reply_count > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {ticket.reply_count} {ticket.reply_count === 1 ? 'reply' : 'replies'}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
              <Pagination
                count={ticketCount}
                pageSize={20}
                page={page}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
  );
}
