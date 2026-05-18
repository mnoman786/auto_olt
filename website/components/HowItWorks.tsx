import { Plus, Zap, CheckCircle, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Plus,
    step: '01',
    title: 'Add Your OLT',
    desc: 'Enter the OLT name, IP address, SNMP version, and admin credentials. Choose between Direct or WireGuard VPN connection. That\'s it.',
    detail: ['Name & IP address', 'SNMP v1/v2c/v3 selection', 'Admin credentials', 'VPN or Direct mode'],
    color: 'blue',
  },
  {
    icon: Zap,
    step: '02',
    title: 'Auto Setup Runs',
    desc: 'Auto OLT immediately validates SNMP connectivity, fetches system info, discovers ports, syncs VLANs and ONU profiles — all automatically.',
    detail: ['SNMP read verification', 'System info fetch', 'Port discovery', 'Profile & VLAN sync'],
    color: 'indigo',
  },
  {
    icon: CheckCircle,
    step: '03',
    title: 'Register ONUs',
    desc: 'Unregistered ONUs appear instantly. Select one or bulk-select hundreds, assign a VLAN, and click Register. Auto OLT handles the Telnet commands.',
    detail: ['ONU discovery via SNMP', 'Bulk registration', 'VLAN assignment', 'Auto profile selection'],
    color: 'violet',
  },
  {
    icon: BarChart3,
    step: '04',
    title: 'Monitor & Manage',
    desc: 'Real-time dashboard shows ONU counts, signal strength, network health, and uptime. Poll on demand or let the platform track everything continuously.',
    detail: ['Live ONU status', 'Signal monitoring', 'VLAN management', 'Support tickets'],
    color: 'purple',
  },
];

const colorMap: Record<string, { badge: string; dot: string; line: string; icon: string }> = {
  blue: { badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500', line: 'from-blue-500/50', icon: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  indigo: { badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', dot: 'bg-indigo-500', line: 'from-indigo-500/50', icon: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  violet: { badge: 'text-violet-400 bg-violet-500/10 border-violet-500/20', dot: 'bg-violet-500', line: 'from-violet-500/50', icon: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  purple: { badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-500', line: 'from-purple-500/50', icon: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/10 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-4">
            Simple 4-Step Process
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            From zero to fully managed
            <br />
            <span className="gradient-text">in under 5 minutes</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            No complex configuration. No CLI expertise required. Auto OLT handles everything after you provide the basics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-16 left-1/8 right-1/8 h-px bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 pointer-events-none" style={{ top: '3.5rem' }} />

          {steps.map((step, i) => {
            const Icon = step.icon;
            const c = colorMap[step.color];
            return (
              <div key={step.step} className="relative group">
                <div className="glass-card rounded-2xl p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/20">
                  {/* Step number */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold mb-4 ${c.badge}`}>
                    STEP {step.step}
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${c.icon}`}>
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="text-white font-bold text-xl mb-3">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">{step.desc}</p>

                  {/* Checklist */}
                  <ul className="space-y-1.5">
                    {step.detail.map(d => (
                      <li key={d} className="flex items-center gap-2 text-xs text-gray-400">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Arrow between steps */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <div className="w-6 h-6 rounded-full bg-[#020817] border border-white/10 flex items-center justify-center">
                      <span className="text-gray-500 text-xs">›</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
