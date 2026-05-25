'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import {
  Network, Check, Zap, Server, Wifi, Shield, Activity,
  Users, LifeBuoy, Layers, Radio, FileText, Cpu, Lock,
  ChevronRight, Star, Gift, Infinity,
} from 'lucide-react';

const features = [
  {
    icon: Server,
    title: 'Unlimited OLT Devices',
    description: 'Add as many OLTs as your network needs — no caps, no tiers.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Radio,
    title: 'ONU Auto-Discovery',
    description: 'Automatically discover every ONU on your PON ports via SNMP polling.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    icon: Zap,
    title: 'One-Click ONU Provisioning',
    description: 'Register and configure ONUs in seconds via automated Telnet provisioning.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: Layers,
    title: 'Full VLAN Management',
    description: 'Create, push, sync, and discover VLANs directly on your OLT from the dashboard.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    icon: Wifi,
    title: 'WireGuard VPN Integration',
    description: 'Securely manage OLTs behind NAT using built-in WireGuard VPN — no public IP needed.',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    icon: Activity,
    title: 'Real-time OLT Monitoring',
    description: 'Live status, signal strength, uptime, and ONU counts — always up to date.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Cpu,
    title: 'Bulk ONU Registration',
    description: 'Register dozens of ONUs at once with shared VLAN and service profiles.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: Layers,
    title: 'Port & Profile Discovery',
    description: 'Auto-discover OLT ports, line profiles, and service profiles via SNMP.',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  {
    icon: FileText,
    title: 'Detailed Setup Logs',
    description: 'Every provisioning step is logged so you can debug issues instantly.',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    icon: Lock,
    title: 'Encrypted Credential Storage',
    description: 'OLT passwords and SNMP communities are encrypted at rest — never stored in plaintext.',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
  },
  {
    icon: Users,
    title: 'Multi-user with Admin Panel',
    description: 'Invite your team, manage user access, and control account status from the admin panel.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: LifeBuoy,
    title: 'Built-in Support Tickets',
    description: 'Submit and track support requests directly inside the platform.',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
  },
];

const vendors = ['Huawei', 'ZTE', 'C-Data', 'V-SOL'];

const included = [
  'All current features',
  'All future features',
  'No usage limits',
  'No credit card required',
  'No hidden charges',
  'No feature paywalls',
];

export default function PlansPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top nav ── */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30">
              <Network className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">Auto OLT</span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Dashboard <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative bg-linear-to-b from-slate-900 via-blue-950 to-indigo-950 text-white overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Forever free badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Gift className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">Forever Free — No Catch</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-5 leading-tight">
            Everything you need.
            <br />
            <span className="bg-linear-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Always free.
            </span>
          </h1>

          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
            Auto OLT is a complete ISP management platform — OLT provisioning, ONU management, VLAN control,
            VPN, monitoring and more. We're giving it all to you at zero cost, forever.
          </p>

          {/* Price callout */}
          <div className="inline-flex flex-col items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-10 py-6 mb-10">
            <div className="flex items-end gap-1 mb-1">
              <span className="text-6xl font-black text-white">$0</span>
              <span className="text-xl text-white/50 mb-2">/month</span>
            </div>
            <span className="text-sm text-emerald-400 font-semibold">Free forever · No credit card</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/30 text-sm"
              >
                Go to Dashboard <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/30 text-sm"
                >
                  Create free account <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 transition-all text-sm"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── What's included strip ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {included.map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vendor support ── */}
      <section className="bg-white py-8 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Supports all major Pakistan ISP vendors
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {vendors.map(v => (
              <span
                key={v}
                className="px-4 py-1.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-full border border-gray-200"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-4">
              <Star className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Everything included</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              A complete platform, for free
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base">
              Every feature listed below is available to every user, from day one, with no restrictions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all p-6 group"
                >
                  <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Why free? ── */}
      <section className="py-20 px-6 bg-linear-to-br from-slate-900 via-blue-950 to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Infinity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Why free?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
            Built for Pakistan's ISPs
          </h2>
          <p className="text-white/60 text-base leading-relaxed mb-6">
            Auto OLT was built specifically for small and mid-sized ISPs in Pakistan who manage
            Huawei, ZTE, C-Data, and V-SOL hardware. We know how expensive enterprise NMS solutions are
            and how little they're tailored to local needs.
          </p>
          <p className="text-white/60 text-base leading-relaxed mb-10">
            Our mission is simple: give every ISP — no matter how small — a professional,
            powerful management platform that costs them nothing. Great software shouldn't be
            a luxury. It should be a given.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { value: '100%', label: 'Free forever' },
              { value: '0', label: 'Hidden fees' },
              { value: '∞', label: 'No limits' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 border border-white/10 rounded-2xl p-5">
                <p className="text-4xl font-black text-white mb-1">{s.value}</p>
                <p className="text-sm text-white/50">{s.label}</p>
              </div>
            ))}
          </div>

          {!/* don't show CTA if already logged in */ false && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg text-sm"
              >
                Start for free — no card needed <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Single plan card ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">One plan. One price.</h2>
            <p className="text-gray-500 text-sm">No tiers. No upgrades. No surprises.</p>
          </div>

          <div className="relative bg-linear-to-br from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-px shadow-2xl shadow-blue-500/30">
            <div className="bg-white rounded-[calc(1.5rem-1px)] p-8">
              {/* Badge */}
              <div className="flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wide">
                  <Check className="h-3 w-3" /> Current plan
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                  <Star className="h-3 w-3 fill-blue-500" /> All features
                </span>
              </div>

              <h3 className="text-2xl font-black text-gray-900 mb-1">Forever Free</h3>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-5xl font-black text-gray-900">$0</span>
                <span className="text-gray-400 mb-1.5 text-lg">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited OLTs & ONUs',
                  'Full VLAN management',
                  'WireGuard VPN support',
                  'SNMP + Telnet provisioning',
                  'Real-time monitoring',
                  'Bulk ONU registration',
                  'Admin user management',
                  'Support ticket system',
                  'All future features included',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              {/* Gradient border button */}
              <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-px rounded-xl">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white text-blue-700 font-bold text-sm rounded-[calc(0.75rem-1px)] hover:bg-blue-50 transition-colors"
                >
                  Get started free <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <p className="text-center text-xs text-gray-400 mt-3">No credit card · No trial period · Free forever</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Network className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold">Auto OLT</span>
            <span className="text-gray-500 text-sm">— ISP Management Platform</span>
          </div>
          <p className="text-xs text-gray-500">Built for Pakistan's ISPs. Free forever.</p>
        </div>
      </footer>

    </div>
  );
}
