'use client';
import AppLayout from '@/components/layout/AppLayout';
import {
  Network, Check, Zap, Server, Wifi, Activity,
  Users, LifeBuoy, Layers, Radio, FileText, Cpu, Lock,
  Star, Gift,
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
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">

        {/* ── Hero ── */}
        <section className="relative bg-linear-to-b from-slate-900 via-blue-950 to-indigo-950 text-white overflow-hidden">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-200 h-150 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
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
              Auto OLT is a complete ISP management platform — OLT provisioning, ONU management,
              VLAN control, VPN, monitoring and more. All of it, at zero cost, forever.
            </p>

            {/* Price callout */}
            <div className="inline-flex flex-col items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-12 py-7">
              <div className="flex items-end gap-1 mb-1">
                <span className="text-7xl font-black text-white">$0</span>
                <span className="text-xl text-white/50 mb-2.5">/month</span>
              </div>
              <span className="text-sm text-emerald-400 font-semibold">Free forever · No credit card · No limits</span>
            </div>
          </div>
        </section>

        {/* ── What's included strip ── */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-7">
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
        <section className="bg-white py-6 border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
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
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-4">
                <Star className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Everything included</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                A complete platform, for free
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto text-base">
                Every feature below is available to every user, from day one, with no restrictions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map(f => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all p-6"
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

        {/* ── Stats banner ── */}
        <section className="bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 py-10 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-6 text-center text-white">
              {[
                { value: '100%', label: 'Free forever' },
                { value: '$0', label: 'Hidden fees' },
                { value: '∞', label: 'No limits' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-4xl sm:text-5xl font-black mb-1">{s.value}</p>
                  <p className="text-sm text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  );
}
