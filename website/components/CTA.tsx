import { ArrowRight, Terminal, Shield } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-violet-950/20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <div className="glass-card rounded-3xl p-12 md:p-16 animated-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6">
            Ready to automate?
          </div>

          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Start managing your OLTs
            <br />
            <span className="gradient-text">smarter today</span>
          </h2>

          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
            Deploy Auto OLT on your server in minutes. No credit card. No vendor lock-in. Just powerful OLT automation — free forever.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <a
              href="#"
              className="group flex items-center gap-2 px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-2xl shadow-blue-700/40 hover:-translate-y-0.5"
            >
              Deploy for Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Install snippet */}
          <div className="bg-[#020817] border border-white/8 rounded-xl p-4 text-left max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-500 font-mono">Quick deploy</span>
            </div>
            <p className="font-mono text-sm text-green-400 terminal-line">git clone https://github.com/auto-olt/auto-olt</p>
            <p className="font-mono text-sm text-green-400 terminal-line mt-1">sudo bash setup.sh</p>
            <p className="font-mono text-sm text-gray-500 mt-2"># Done. Visit http://your-server:3000</p>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-green-400" />
              Self-hosted & private
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-700" />
            <span>Open source</span>
            <div className="w-1 h-1 rounded-full bg-gray-700" />
            <span>No vendor lock-in</span>
          </div>
        </div>
      </div>
    </section>
  );
}
