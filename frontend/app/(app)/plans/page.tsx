'use client';
import { useEffect, useState } from 'react';
import { oltApi } from '@/lib/api';
import {
  Check, Zap, Server, Wifi, Activity, Users, LifeBuoy,
  Layers, Radio, FileText, Cpu, Lock, Gift, ArrowRight,
  ShieldCheck, BarChart2, Network, Infinity as InfinityIcon,
} from 'lucide-react';

const featureGroups = [
  {
    label: 'Device Management',
    color: 'blue',
    items: [
      { icon: Server,   title: 'Unlimited OLT Devices',       desc: 'Add as many OLTs as your network needs — no caps or tiers.' },
      { icon: Radio,    title: 'ONU Auto-Discovery',           desc: 'Automatically discover every ONU on your PON ports via SNMP.' },
      { icon: Zap,      title: 'One-Click ONU Provisioning',   desc: 'Register and configure ONUs in seconds via automated Telnet.' },
      { icon: Cpu,      title: 'Bulk ONU Registration',        desc: 'Register dozens of ONUs at once with shared VLAN and service profiles.' },
    ],
  },
  {
    label: 'Network Control',
    color: 'violet',
    items: [
      { icon: Layers,   title: 'Full VLAN Management',         desc: 'Create, push, sync, and discover VLANs directly on your OLT.' },
      { icon: Wifi,     title: 'WireGuard VPN Integration',    desc: 'Manage OLTs behind NAT using built-in WireGuard — no public IP needed.' },
      { icon: Network,  title: 'Port & Profile Discovery',     desc: 'Auto-discover OLT ports, line profiles, and service profiles via SNMP.' },
      { icon: BarChart2,title: 'Bandwidth Monitoring',         desc: 'Real-time bandwidth charts per OLT and per port, always up to date.' },
    ],
  },
  {
    label: 'Operations & Security',
    color: 'emerald',
    items: [
      { icon: Activity, title: 'Real-time Monitoring',         desc: 'Live status, signal strength, uptime, and ONU counts.' },
      { icon: FileText, title: 'Detailed Setup Logs',          desc: 'Every provisioning step is logged so you can debug instantly.' },
      { icon: Lock,     title: 'Encrypted Credentials',        desc: 'OLT passwords and SNMP communities encrypted at rest.' },
      { icon: ShieldCheck, title: 'Multi-user Admin Panel',    desc: 'Invite your team, manage users, and control access.' },
    ],
  },
  {
    label: 'Support & Reporting',
    color: 'orange',
    items: [
      { icon: LifeBuoy, title: 'Built-in Support Tickets',     desc: 'Submit and track support requests directly inside the platform.' },
      { icon: Users,    title: 'Team Collaboration',           desc: 'Multiple users per account with role-based access control.' },
      { icon: FileText, title: 'Excel Reports',                desc: 'Download full OLT and ONU reports as Excel spreadsheets.' },
      { icon: Radio,    title: 'Signal History Charts',        desc: 'Historical signal strength graphs per ONU over 24–168 hours.' },
    ],
  },
];

const colorMap: Record<string, { ring: string; badge: string; icon: string; dot: string }> = {
  blue:    { ring: 'ring-blue-100 dark:ring-blue-900/40',    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800',    icon: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',    dot: 'bg-blue-500' },
  violet:  { ring: 'ring-violet-100 dark:ring-violet-900/40', badge: 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-800', icon: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30', dot: 'bg-violet-500' },
  emerald: { ring: 'ring-emerald-100 dark:ring-emerald-900/40', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800', icon: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
  orange:  { ring: 'ring-orange-100 dark:ring-orange-900/40', badge: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800', icon: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30', dot: 'bg-orange-500' },
};

const vendors = ['Huawei', 'ZTE', 'C-Data', 'V-SOL'];

const included = [
  'All features included',
  'Unlimited devices',
  'No credit card',
  'No hidden fees',
  'Free during beta',
  'Priority support',
];

export default function PlansPage() {
  const [oltCount, setOltCount] = useState<number | null>(null);

  useEffect(() => {
    oltApi.list().then(r => setOltCount(r.data.count ?? r.data.results?.length ?? 0)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-linear-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-125 w-175 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
          {/* grid dots */}
          <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <Gift className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/90">Free During Beta — No Credit Card</span>
          </div>

          <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            One plan.{' '}
            <span className="bg-linear-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Everything included.
            </span>
          </h1>
          <p className="mx-auto mb-12 max-w-xl text-lg text-white/60">
            Auto OLT is a complete ISP management platform. Every feature, for every user, for free right now.
          </p>

          {/* Pricing card */}
          <div className="mx-auto max-w-sm">
            <div className="relative rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-md shadow-2xl shadow-black/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/40">
                  Free During Beta
                </span>
              </div>

              <div className="mb-1 flex items-end justify-center gap-1">
                <span className="text-8xl font-black text-white leading-none">$0</span>
                <span className="mb-3 text-xl text-white/40">/mo</span>
              </div>
              <p className="text-sm text-white/50">No credit card · No commitment · Cancel anytime</p>

              {/* Live OLT quota */}
              <div className="my-5 flex items-center justify-center gap-3 rounded-xl bg-white/10 px-4 py-3">
                <Server className="h-4 w-4 text-white/50 shrink-0" />
                <span className="text-sm text-white/70">OLT devices used</span>
                <span className="ml-auto flex items-center gap-1.5 font-bold text-white">
                  <span className="tabular-nums">{oltCount === null ? '…' : oltCount}</span>
                  <span className="text-white/40">/</span>
                  <InfinityIcon className="h-4 w-4 text-white/60" />
                </span>
              </div>

              <ul className="mb-8 space-y-3 text-left">
                {included.map(item => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="h-3 w-3 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-white/80">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30">
                <span>You're on this plan</span>
                <Check className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vendor strip ── */}
      <section className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-5">
        <div className="mx-auto max-w-5xl px-6 flex flex-wrap items-center justify-center gap-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Supports
          </span>
          {vendors.map(v => (
            <span
              key={v}
              className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300"
            >
              {v}
            </span>
          ))}
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">OLT vendors</span>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Everything you get — for free</h2>
          <p className="text-gray-500 dark:text-gray-400">No paywalls, no feature gates. Every capability is available from day one.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {featureGroups.map(group => {
            const c = colorMap[group.color];
            return (
              <div
                key={group.label}
                className={`rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm ring-1 ${c.ring} overflow-hidden`}
              >
                <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c.badge}`}>
                    {group.label}
                  </span>
                </div>
                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <li key={item.title} className="flex items-start gap-3 px-5 py-4">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.icon}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-600 via-indigo-600 to-violet-600 p-10 text-center shadow-xl shadow-blue-500/20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-10 right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/60">Already using Auto OLT</p>
            <h3 className="mb-2 text-3xl font-extrabold text-white">Enjoying the platform?</h3>
            <p className="mx-auto mb-8 max-w-md text-white/70">
              We're working on more features. If you have ideas or feedback, open a support ticket — we read every one.
            </p>
            <a
              href="/tickets/new"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-lg shadow-black/20 hover:bg-white/90 transition-colors"
            >
              Send Feedback
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
