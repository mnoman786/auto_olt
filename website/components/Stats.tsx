const stats = [
  { value: '100%', label: 'Free Forever', desc: 'No hidden costs, no subscriptions, no limits' },
  { value: '∞', label: 'OLTs Supported', desc: 'Add as many OLT devices as your network needs' },
  { value: '0', label: 'CLI Commands', desc: 'Full automation — no manual telnet sessions' },
  { value: '4+', label: 'Vendor Support', desc: 'Huawei, ZTE, C-Data, V-SOL and more' },
];

export default function Stats() {
  return (
    <section className="py-16 border-y border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-violet-600/5" />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden">
          {stats.map((s, i) => (
            <div key={i} className="bg-[#020817] px-8 py-10 text-center group hover:bg-[#0d1117] transition-colors">
              <div className="text-5xl md:text-6xl font-black gradient-text mb-2">{s.value}</div>
              <div className="text-white font-bold text-lg mb-2">{s.label}</div>
              <div className="text-gray-500 text-sm leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
