import { CheckCircle } from 'lucide-react';

const vendors = [
  {
    name: 'Huawei',
    models: ['MA5600T', 'MA5608T', 'MA5683T', 'MA5800-X15', 'MA5800-X17'],
    status: 'Primary — Full Support',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    dot: 'bg-red-400',
    logo: 'H',
    logoColor: 'from-red-600 to-rose-700',
    desc: 'Tested and optimized for Huawei GPON OLTs. Full ONU registration, profile sync, VLAN push, and SNMP polling via MA5600/MA5800 series CLI.',
  },
  {
    name: 'ZTE',
    models: ['C300', 'C320', 'C600', 'C650'],
    status: 'Supported',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
    logo: 'Z',
    logoColor: 'from-blue-600 to-indigo-700',
    desc: 'ZTE GPON platform support with SNMP discovery and Telnet automation for the C300/C320 series.',
  },
  {
    name: 'C-Data',
    models: ['FD1104S', 'FD1108S', 'FD8908'],
    status: 'Supported',
    badge: 'bg-green-500/10 text-green-400 border-green-500/20',
    dot: 'bg-green-400',
    logo: 'C',
    logoColor: 'from-green-600 to-emerald-700',
    desc: 'C-Data OLT support with SNMP-based ONU discovery and Telnet-driven provisioning.',
  },
  {
    name: 'V-SOL',
    models: ['V1600D', 'V1600G', 'V1600D4L'],
    status: 'Supported',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    dot: 'bg-violet-400',
    logo: 'V',
    logoColor: 'from-violet-600 to-purple-700',
    desc: 'V-SOL GPON OLT management with SNMP polling and automated ONU registration.',
  },
];

const protocols = [
  'SNMP v1 / v2c / v3',
  'Telnet CLI automation',
  'Q-BRIDGE-MIB',
  'Huawei enterprise MIBs',
  'WireGuard VPN tunneling',
  'JWT-secured REST API',
];

export default function Hardware() {
  return (
    <section id="hardware" className="py-28 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/6 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-xs font-semibold uppercase tracking-wider mb-4">
            Hardware Compatibility
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Works with the gear
            <br />
            <span className="gradient-text">you already have</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Auto OLT supports the most popular GPON OLT vendors used by ISPs across Pakistan and beyond.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {vendors.map(v => (
            <div key={v.name} className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 hover:-translate-y-0.5 group">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${v.logoColor} flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0 group-hover:scale-105 transition-transform`}>
                  {v.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-white font-bold text-xl">{v.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${v.badge}`}>
                      {v.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">{v.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {v.models.map(m => (
                      <span key={m} className="text-xs font-mono text-gray-400 bg-white/4 border border-white/8 px-2 py-0.5 rounded-md">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Protocols */}
        <div className="glass-card rounded-2xl p-8">
          <h3 className="text-white font-bold text-lg mb-6 text-center">Supported Protocols & Standards</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {protocols.map(p => (
              <div key={p} className="flex items-center gap-2 bg-white/3 border border-white/6 rounded-xl px-3 py-2.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-gray-300 font-medium">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
