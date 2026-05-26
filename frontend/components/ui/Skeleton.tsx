'use client';
import React from 'react';

/** Single shimmer block — base primitive used by all skeletons. */
export function Sk({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-gray-100 dark:bg-gray-700 animate-pulse rounded ${className}`} style={style} />;
}

// ─────────────────────────────────────────────
// Dashboard skeleton
// Matches: header + 4 stat cards + OLT list rows
// ─────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="relative p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="space-y-2">
          <Sk className="h-3 w-20" />
          <Sk className="h-8 w-56" />
          <Sk className="h-3.5 w-40" />
        </div>
        <div className="flex gap-2">
          <Sk className="h-9 w-24 rounded-lg" />
          <Sk className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Sk className="h-3 w-20" />
              <Sk className="h-8 w-8 rounded-lg" />
            </div>
            <Sk className="h-7 w-16" />
            <Sk className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* OLT list card */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <Sk className="h-4 w-32" />
          <Sk className="h-5 w-16 rounded-full" />
        </div>
        {/* Rows */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="px-6 py-4 border-b border-gray-50 dark:border-gray-700 last:border-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sk className="w-10 h-10 rounded-lg shrink-0" />
                <div className="space-y-2">
                  <Sk className="h-3.5 w-36" />
                  <Sk className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Sk className="h-3 w-28 hidden md:block" />
                <Sk className="h-6 w-16 rounded-full" />
                <Sk className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OLT Detail skeleton
// Matches: back link + header + 4 stats + 4 quick-links + VLANs card + Profiles card + 2 info cards
// ─────────────────────────────────────────────
export function OLTDetailSkeleton() {
  return (
    <div className="relative p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Sk className="h-4 w-32 mb-6" />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-center gap-4">
          <Sk className="w-14 h-14 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Sk className="h-3 w-16" />
            <Sk className="h-7 w-48" />
            <Sk className="h-3.5 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(i => <Sk key={i} className="h-8 w-20 rounded-lg" />)}
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <Sk className="h-3 w-20" />
              <Sk className="h-8 w-8 rounded-lg" />
            </div>
            <Sk className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* 4 quick-link cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Sk className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-3.5 w-full" />
                <Sk className="h-3 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* VLANs card */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sk className="h-4 w-4 rounded" />
            <Sk className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Sk className="h-8 w-20 rounded-lg" />
            <Sk className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="px-6 py-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <Sk key={i} className="h-6 w-16 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Profiles card */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sk className="h-4 w-4 rounded" />
            <Sk className="h-4 w-40" />
          </div>
          <Sk className="h-8 w-28 rounded-lg" />
        </div>
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Sk className="h-3 w-24 mb-3" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map(i => <Sk key={i} className="h-6 w-20 rounded-lg" />)}
            </div>
          </div>
          <div className="space-y-2">
            <Sk className="h-3 w-24 mb-3" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map(i => <Sk key={i} className="h-6 w-20 rounded-lg" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Two info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1].map(card => (
          <div key={card} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Sk className="h-4 w-4 rounded" />
              <Sk className="h-4 w-36" />
            </div>
            <div className="px-6 py-4 space-y-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <Sk className="h-3 w-28" />
                  <Sk className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Bandwidth page skeleton
// Matches: back link + header + time-window buttons + 4 stat cards + 3 chart cards
// ─────────────────────────────────────────────
export function BandwidthSkeleton() {
  return (
    <div className="relative p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <Sk className="h-4 w-24 mb-4" />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-4">
          <Sk className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Sk className="h-3 w-20" />
            <Sk className="h-7 w-44" />
            <Sk className="h-3.5 w-36" />
          </div>
        </div>
        {/* Time window selector + refresh button */}
        <div className="flex items-center gap-2">
          <Sk className="h-9 w-56 rounded-lg" />
          <Sk className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-2">
            <Sk className="h-3 w-24" />
            <Sk className="h-6 w-28" />
          </div>
        ))}
      </div>

      {/* Chart cards */}
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden mb-4">
          {/* Card header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sk className="h-4 w-4 rounded" />
              <Sk className="h-4 w-28" />
              <Sk className="h-5 w-14 rounded-md" />
            </div>
            <div className="flex items-center gap-4">
              <Sk className="h-3 w-20" />
              <Sk className="h-3 w-20" />
            </div>
          </div>
          {/* Chart area */}
          <div className="p-4">
            <Sk className="h-50 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ONU table skeleton (used inside the table card while fetching)
// Matches: 8-column table header + rows
// ─────────────────────────────────────────────
export function ONUTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            {/* checkbox / serial / port / signal / vlan / status / last seen / actions */}
            {[10, 180, 80, 70, 70, 90, 110, 80].map((w, i) => (
              <th key={i} className="px-4 py-3">
                <Sk className={`h-3 rounded`} style={{ width: w }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              <td className="px-4 py-3"><Sk className="h-4 w-4 rounded" /></td>
              <td className="px-4 py-3 space-y-1.5">
                <Sk className="h-3.5 w-36" />
                <Sk className="h-3 w-24" />
              </td>
              <td className="px-4 py-3"><Sk className="h-3 w-16" /></td>
              <td className="px-4 py-3"><Sk className="h-3 w-14" /></td>
              <td className="px-4 py-3"><Sk className="h-5 w-16 rounded-full" /></td>
              <td className="px-4 py-3"><Sk className="h-5 w-20 rounded-full" /></td>
              <td className="px-4 py-3"><Sk className="h-3 w-24" /></td>
              <td className="px-4 py-3 flex justify-end gap-2">
                <Sk className="h-7 w-14 rounded-lg" />
                <Sk className="h-7 w-18 rounded-lg" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// ONU page skeleton (full page while auth/initial load)
// Matches: back + header + 3 stat chips + tabs + search + table
// ─────────────────────────────────────────────
export function ONUPageSkeleton() {
  return (
    <div className="relative p-6 max-w-7xl mx-auto">
      {/* Back link */}
      <Sk className="h-4 w-24 mb-4" />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-4">
          <Sk className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <Sk className="h-3 w-20" />
            <Sk className="h-7 w-44" />
            <Sk className="h-3.5 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Sk className="h-8 w-32 rounded-lg" />
          <Sk className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* 3 stat chips */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3 shadow-sm">
            <Sk className="w-9 h-9 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <Sk className="h-3 w-16" />
              <Sk className="h-5 w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200 dark:border-gray-700 pb-0">
        {[0, 1, 2].map(i => (
          <Sk key={i} className="h-9 w-32 rounded-t-lg" />
        ))}
      </div>

      {/* Search bar */}
      <Sk className="h-9 w-full rounded-lg mb-4" />

      {/* Table card */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <ONUTableSkeleton />
      </div>
    </div>
  );
}
