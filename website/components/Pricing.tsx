import { CheckCircle, Zap, Heart } from 'lucide-react';

const features = [
  'Unlimited OLT devices',      'Unlimited ONU management',
  'SNMP v1/v2c/v3 support',     'WireGuard VPN integration',
  'Auto setup wizard',          'ONU bulk registration',
  'Profile auto-discovery',     'VLAN management',
  'Bandwidth monitoring',       'Signal history charts',
  'Smart alert rules',          'NOC View dashboard',
  'Customer management',        'Auto-provisioning',
  'Support ticket system',      'Your data, your server',
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            Pricing
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
            One plan. <span className="gradient-text">Free forever.</span>
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            No trial periods, no paywalls. Every feature included for everyone, always.
          </p>
        </div>

        {/* Card */}
        <div className="relative max-w-xl mx-auto">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/40 via-indigo-500/40 to-violet-500/40 blur-sm" />
          <div className="relative rounded-2xl bg-[#0d1117] border border-white/10 overflow-hidden">

            {/* Top strip */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-white" />
                <span className="text-white font-bold text-sm">Auto OLT — Full Access</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 bg-white/20 px-2.5 py-0.5 rounded-full">
                Free Forever
              </span>
            </div>

            <div className="p-5">
              {/* Price row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-end gap-1.5">
                  <span className="text-5xl font-black text-white leading-none">$0</span>
                  <span className="text-gray-500 text-xs mb-1">/month</span>
                </div>
                <a
                  href="#"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-700/30 hover:-translate-y-0.5"
                >
                  Get Started Free →
                </a>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                {features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    <span className="text-xs text-gray-400">{f}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-gray-600">
                <Heart className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                Built for the ISP community. Your data stays on your server — always.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
