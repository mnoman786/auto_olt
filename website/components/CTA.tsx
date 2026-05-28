import { ArrowRight, Shield, Mail, MessageCircle } from 'lucide-react';

export default function CTA() {
  return (
    <section id="contact" className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-violet-950/20 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-2xl mx-auto px-6">
        <div className="relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/40 via-indigo-500/40 to-violet-500/40 blur-sm" />
          <div className="relative rounded-2xl bg-[#0d1117] border border-white/10 p-8 md:p-10 text-center">

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4">
              Get Early Access
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 leading-tight">
              Ready to automate
              <span className="gradient-text"> your OLT network?</span>
            </h2>

            <p className="text-gray-400 text-sm max-w-md mx-auto mb-7">
              Auto OLT is in active development. Contact us to get early access and start managing your OLT devices smarter — no CLI needed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7">
              <a
                href="mailto:support@autoolt.com"
                className="group inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-xl shadow-blue-700/30 hover:-translate-y-0.5"
              >
                <Mail className="h-4 w-4" />
                Email Us
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs text-gray-600 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-green-400" />
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
