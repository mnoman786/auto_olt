import { ArrowRight, Zap, Shield, Wifi } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '#';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-hero-grid opacity-100" />
        {/* Radial fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020817]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-8 badge-shine">
          <Zap className="h-3.5 w-3.5" />
          Smart ISP Management — Built for GPON Networks
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          The Smartest Way to
          <br />
          <span className="gradient-text">Manage Your OLTs</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Auto OLT automates ONU provisioning, VLAN management, SNMP discovery, and real-time monitoring across all your OLT devices — with zero CLI interaction.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href={APP_URL}
            className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-2xl shadow-blue-700/40 hover:shadow-blue-700/60 hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#features"
            className="flex items-center gap-2 px-8 py-4 text-base font-semibold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all hover:-translate-y-0.5"
          >
            Explore Features
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          {[
            { icon: Shield, text: 'Secure & Self-hosted' },
            { icon: Zap, text: 'SNMP Auto-Discovery' },
            { icon: Wifi, text: 'Multi-OLT Support' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-blue-400" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard preview mockup */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 mt-16">
        <div className="relative animate-float">
          {/* Glow behind the card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-violet-600/20 rounded-2xl blur-xl" />
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d1117]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="ml-4 flex-1 bg-[#0d1117] rounded-md px-3 py-1 text-xs text-gray-500 font-mono">
                autoolt.app/dashboard
              </div>
            </div>
            {/* Dashboard UI mockup */}
            <div className="p-6 bg-gradient-to-br from-[#0d1117] to-[#0a0f1e]">
              {/* Top stats */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total OLTs', value: '12', color: 'blue' },
                  { label: 'Network Health', value: '98%', color: 'green' },
                  { label: 'Total ONUs', value: '1,248', color: 'indigo' },
                  { label: 'Issues', value: '0', color: 'emerald' },
                ].map(s => (
                  <div key={s.label} className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                    <p className={`text-xl font-bold text-${s.color}-400`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {/* OLT list */}
              <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">OLT Devices</span>
                  <span className="text-xs text-gray-600">12 devices</span>
                </div>
                {[
                  { name: 'Main-OLT-01', ip: '103.115.198.1', onus: 256, status: 'active' },
                  { name: 'Branch-OLT-02', ip: '192.168.2.1', onus: 128, status: 'active' },
                  { name: 'Tower-OLT-03', ip: '10.10.5.1', onus: 64, status: 'configuring' },
                ].map(olt => (
                  <div key={olt.name} className="flex items-center justify-between px-4 py-3 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Wifi className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1117] ${olt.status === 'active' ? 'bg-green-400' : 'bg-blue-400 animate-pulse'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{olt.name}</p>
                        <p className="text-xs text-gray-600 font-mono">{olt.ip}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-gray-500">{olt.onus} ONUs</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        olt.status === 'active'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {olt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
