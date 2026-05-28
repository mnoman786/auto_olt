const stats = [
  { value: '18+', label: 'Features Built', desc: 'From ONU provisioning to customer management and NOC dashboards' },
  { value: '4+',  label: 'Vendors Supported', desc: 'Huawei, ZTE, C-Data, V-SOL and growing' },
  { value: '0',   label: 'CLI Commands', desc: 'Full automation — no manual Telnet or SNMP sessions ever' },
  { value: '∞',   label: 'ONUs Managed', desc: 'No device limits — scale from 10 to 10,000 ONUs' },
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
