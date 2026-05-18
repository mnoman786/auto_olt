import {
  Zap, Shield, Wifi, Network, Settings, BarChart3,
  Terminal, RefreshCw, Users, LifeBuoy, Layers, GitBranch,
  Eye, Lock, Globe, Cpu,
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    color: 'blue',
    title: 'Auto Setup Wizard',
    desc: 'One-click OLT onboarding. Auto OLT connects, validates SNMP, fetches system info, and configures your device — no CLI needed.',
  },
  {
    icon: Wifi,
    color: 'indigo',
    title: 'ONU Discovery',
    desc: 'Automatically discovers all unregistered ONUs via SNMP polling. Instantly shows serial numbers, MAC addresses, and PON port assignments.',
  },
  {
    icon: Layers,
    color: 'violet',
    title: 'ONU Registration',
    desc: 'Register individual or bulk ONUs from the dashboard. Auto OLT pushes the correct Telnet commands with line/service profiles — no CLI needed.',
  },
  {
    icon: Network,
    color: 'cyan',
    title: 'VLAN Management',
    desc: 'Create, push, and sync VLANs across your OLTs. Discover existing VLANs from the device via SNMP or Telnet fallback.',
  },
  {
    icon: Shield,
    color: 'green',
    title: 'SNMP Discovery',
    desc: 'Full SNMP v1/v2c/v3 support. Polls Q-BRIDGE-MIB and Huawei-specific OIDs to discover ports, ONUs, VLANs, and system info.',
  },
  {
    icon: Terminal,
    color: 'emerald',
    title: 'Telnet Automation',
    desc: 'Automates all Telnet CLI operations — ONU registration, VLAN push, profile sync, and setup — using stored admin credentials.',
  },
  {
    icon: GitBranch,
    color: 'purple',
    title: 'Profile Auto-Sync',
    desc: 'Discovers line profiles and service profiles directly from the OLT CLI. No manual profile ID entry — profiles are cached and used automatically.',
  },
  {
    icon: Globe,
    color: 'blue',
    title: 'VPN / WireGuard Support',
    desc: 'Manage remote OLTs behind NAT via WireGuard VPN. Auto OLT assigns unique virtual IPs from a 10.100.0.0/16 pool and configures peers.',
  },
  {
    icon: BarChart3,
    color: 'indigo',
    title: 'Real-time Monitoring',
    desc: 'Live ONU counts, signal strength, registration status, and system uptime. Poll your OLT on-demand or let the system track it automatically.',
  },
  {
    icon: Users,
    color: 'violet',
    title: 'Multi-User Management',
    desc: 'Full role-based access control. Each user manages their own OLT devices independently with secure, isolated account access.',
  },
  {
    icon: LifeBuoy,
    color: 'rose',
    title: 'Support Ticket System',
    desc: 'Built-in helpdesk. Users submit tickets linked to specific OLTs. Admins reply inline, update status, and close tickets — all from the dashboard.',
  },
  {
    icon: RefreshCw,
    color: 'amber',
    title: 'Error Recovery',
    desc: 'Stuck setup? Hit Reset Status. Locked out of the OLT? Auto OLT helps diagnose Telnet failures with live connection testing before committing.',
  },
];

const colorMap: Record<string, string> = {
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400',
  indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-400',
  violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400',
  cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-400',
  green: 'from-green-500/20 to-green-600/10 border-green-500/20 text-green-400',
  emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
  purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
  rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/20 text-rose-400',
  amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400',
};

export default function Features() {
  return (
    <section id="features" className="py-28 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
            Everything Included
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Every feature you need,
            <br />
            <span className="gradient-text-blue">completely free</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Auto OLT packs enterprise-grade OLT automation into a self-hosted platform with no feature limits, no paywalls, and no subscriptions.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            const colors = colorMap[f.color] || colorMap.blue;
            const [fromTo, border, text] = colors.split(' ');
            return (
              <div
                key={f.title}
                className="glass-card rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/20 group cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${fromTo} border ${border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-5 w-5 ${text}`} />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
