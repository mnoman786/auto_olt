import { CheckCircle, Zap, Heart } from 'lucide-react';

const features = [
  'Unlimited OLT devices',
  'Unlimited ONU management',
  'Unlimited VLAN management',
  'SNMP v1/v2c/v3 support',
  'WireGuard VPN integration',
  'Auto setup wizard',
  'ONU bulk registration',
  'Profile auto-discovery',
  'Real-time monitoring',
  'Bandwidth monitoring',
  'Signal history charts',
  'Smart alert rules',
  'NOC View dashboard',
  'Customer management',
  'Auto-provisioning',
  'Support ticket system',
  'Multi-user accounts',
  'Your data, your server',
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-28 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4">
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            One plan.
            <br />
            <span className="gradient-text">Free forever.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            No trial. No freemium. No enterprise upsell. Auto OLT is 100% free — every feature included for everyone.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-blue-500/50 via-indigo-500/50 to-violet-500/50 blur-sm" />
            <div className="relative rounded-3xl bg-[#0d1117] border border-white/10 overflow-hidden">
              {/* Top banner */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-white" />
                  <span className="text-white font-bold text-lg">Auto OLT — Full Access</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/80 bg-white/20 px-3 py-1 rounded-full">
                  Free Forever
                </span>
              </div>

              <div className="p-8">
                {/* Price */}
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-8xl font-black text-white leading-none">$0</span>
                  <div className="mb-3">
                    <div className="text-gray-400 text-sm">/ month</div>
                    <div className="text-gray-600 text-xs">forever</div>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-8">
                  All features unlocked from day one. No hidden costs, no upgrade prompts.
                </p>

                {/* CTA */}
                <a
                  href="#"
                  className="block w-full text-center py-4 px-8 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-xl shadow-blue-700/30 hover:shadow-blue-700/50 hover:-translate-y-0.5 mb-8"
                >
                  Get Started Free →
                </a>

                {/* Features grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {features.map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                      <span className="text-gray-300">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-2 text-sm text-gray-500">
                  <Heart className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>Built with love for the ISP community. Your data stays on your server — always.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
