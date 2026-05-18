import { ArrowRight, Shield, Mail } from 'lucide-react';

export default function CTA() {
  return (
    <section id="contact" className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-violet-950/20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6">
        <div className="relative">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-blue-500/50 via-indigo-500/50 to-violet-500/50 blur-sm" />
          <div className="relative rounded-3xl bg-[#0d1117] border border-white/10 p-10 md:p-16 text-center">

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6">
              Get Early Access
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
              Ready to automate
              <br />
              <span className="gradient-text">your OLT network?</span>
            </h2>

            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
              Auto OLT is currently in active development. Contact us to get early access and start managing your OLT devices smarter.
            </p>

            <a
              href="mailto:support@autoolt.com"
              className="group inline-flex items-center gap-2.5 px-10 py-4 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-2xl shadow-blue-700/40 hover:shadow-blue-700/60 hover:-translate-y-0.5"
            >
              <Mail className="h-4 w-4" />
              Contact Us
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>

            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-green-400" />
                Private &amp; Secure
              </div>
              <div className="w-1 h-1 rounded-full bg-gray-700" />
              <span>No vendor lock-in</span>
              <div className="w-1 h-1 rounded-full bg-gray-700" />
              <span>Built for ISPs</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
