'use client';

import { useEffect, useState } from 'react';
import { X, Info, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { announcementsApi } from '@/lib/api';
import type { Announcement, AnnouncementType } from '@/lib/types';

const TYPE_STYLES: Record<AnnouncementType, { bar: string; icon: string; bg: string; text: string }> = {
  info:     { bar: 'bg-blue-500',    icon: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40',    text: 'text-blue-900 dark:text-blue-100' },
  success:  { bar: 'bg-emerald-500', icon: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-900 dark:text-emerald-100' },
  warning:  { bar: 'bg-yellow-500',  icon: 'text-yellow-500',  bg: 'bg-yellow-50 dark:bg-yellow-950/40',  text: 'text-yellow-900 dark:text-yellow-100' },
  critical: { bar: 'bg-red-500',     icon: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/40',        text: 'text-red-900 dark:text-red-100' },
};

const TYPE_ICON: Record<AnnouncementType, React.ElementType> = {
  info:     Info,
  success:  CheckCircle,
  warning:  AlertTriangle,
  critical: AlertOctagon,
};

const STORAGE_KEY = 'dismissed_announcements';

// Module-level Set — survives component remounts within the same browser session.
// Initialized once from localStorage so dismissals persist across reloads too.
const dismissedIds: Set<number> = new Set(
  typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } })()
    : []
);

function persistDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(dismissedIds)));
  } catch {}
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    announcementsApi.list().then(r => {
      const all: Announcement[] = (r.data as any).results ?? r.data;
      setAnnouncements(all.filter(a => !a.is_dismissible || !dismissedIds.has(a.id)));
    }).catch(() => {});
  }, []);

  function dismiss(id: number) {
    dismissedIds.add(id);
    persistDismissed();
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }

  if (announcements.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {announcements.map(a => {
        const styles = TYPE_STYLES[a.type];
        const Icon = TYPE_ICON[a.type];
        return (
          <div key={a.id} className={`relative flex items-start gap-3 px-4 py-3 ${styles.bg} border-b border-black/5 dark:border-white/5`}>
            <div className={`absolute left-0 inset-y-0 w-1 rounded-r ${styles.bar}`} />
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
            <div className={`flex-1 min-w-0 text-sm ${styles.text}`}>
              <span className="font-semibold">{a.title}:</span>{' '}
              <span>{a.message}</span>
            </div>
            {a.is_dismissible && (
              <button
                onClick={() => dismiss(a.id)}
                className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X className={`h-3.5 w-3.5 ${styles.icon}`} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
