import { CheckCircle } from 'lucide-react';

const vendors = [
  {
    name: 'Huawei',
    models: ['MA5600T', 'MA5608T', 'MA5683T', 'MA5800-X15', 'MA5800-X17'],
    status: 'Primary — Full Support',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    logo: 'H',
    logoColor: 'from-red-600 to-rose-700',
    desc: 'Full ONU registration, profile sync, VLAN push, and SNMP polling via MA5600/MA5800 series CLI.',
  },
  {
    name: 'ZTE',
    models: ['C300', 'C320', 'C600', 'C650'],
    status: 'Supported',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    logo: 'Z',
    logoColor: 'from-blue-600 to-indigo-700',
    desc: 'SNMP discovery and Telnet automation for ZTE C300/C320 GPON series.',
  },
  {
    name: 'C-Data',
    models: ['FD1104S', 'FD1108S', 'FD8908'],
    status: 'Supported',
    badge: 'bg-green-500/10 text-green-400 border-green-500/20',
    logo: 'C',
    logoColor: 'from-green-600 to-emerald-700',
    desc: 'SNMP-based ONU discovery and Telnet-driven provisioning for C-Data OLTs.',
  },
  {
    name: 'V-SOL',
    models: ['V1600D', 'V1600G', 'V1600D4L'],
    status: 'Supported',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    logo: 'V',
    logoColor: 'from-violet-600 to-purple-700',
    desc: 'SNMP polling and automated ONU registration for V-SOL GPON OLTs.',
  },
];

const protocols = [
  'SNMP v1 / v2c / v3',
  'Telnet CLI automation',
  'Q-BRIDGE-MIB',
  'Huawei enterprise MIBs',
  'WireGuard VPN',
  'JWT-secured REST API',
];

export default function Hardware() {
  return (
    <section id="hardware" className="py-20 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-violet-600/6 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-xs font-semibold uppercase tracking-wider mb-3">
            Hardware Compatibility
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
            Works with the gear
            <span className="gradient-text"> you already have</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Supports the most popular GPON OLT vendors used by ISPs across Pakistan and beyond.
          </p>
        </div>

        {/* Vendor grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {vendors.map(v => (
            <div key={v.name} className="glass-card rounded-xl p-4 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 hover:-translate-y-0.5 group flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${v.logoColor} flex items-center justify-center text-white font-black text-lg shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                {v.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-white font-bold text-sm">{v.name}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${v.badge}`}>
                    {v.status}
                  </span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed mb-2">{v.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {v.models.map(m => (
                    <span key={m} className="text-[10px] font-mono text-gray-400 bg-white/4 border border-white/8 px-1.5 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Protocols */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4 text-center">Supported Protocols & Standards</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {protocols.map(p => (
              <div key={p} className="flex items-center gap-1.5 bg-white/3 border border-white/6 rounded-lg px-2.5 py-2">
                <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                <span className="text-[11px] text-gray-300 font-medium">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
