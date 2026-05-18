import { Network, Github, Heart } from 'lucide-react';

const links = {
  Product: ['Features', 'How it Works', 'Hardware', 'Pricing'],
  Support: ['Documentation', 'GitHub Issues', 'Setup Guide', 'FAQ'],
  Legal: ['Privacy Policy', 'Terms of Use', 'License (MIT)'],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#020817] relative">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Network className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-white font-bold text-lg">Auto OLT</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400/70">ISP Platform</span>
              </div>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs mb-5">
              The smart ISP management platform. Automate OLT provisioning, ONU registration, and network monitoring — free forever.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="w-9 h-9 rounded-lg bg-white/4 border border-white/8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/8 transition-all">
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([col, items]) => (
            <div key={col}>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">{col}</h4>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} Auto OLT. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-gray-600 text-sm">
            Made with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" /> for ISPs worldwide
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-gray-500">100% Free — Always</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
