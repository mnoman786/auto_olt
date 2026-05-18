'use client';
import { useState } from 'react';
import {
  Wifi, CheckCircle, XCircle, Layers, LifeBuoy,
  Terminal, Play, AlertCircle, Clock, ChevronRight,
  Shield, User, MessageSquare, Server,
} from 'lucide-react';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'setup', label: 'Setup Wizard' },
  { id: 'onus', label: 'ONU Management' },
  { id: 'vlans', label: 'VLAN Manager' },
  { id: 'tickets', label: 'Support Tickets' },
];

function DashboardScreen() {
  return (
    <div className="p-5 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Total OLTs', v: '8', sub: '6 online', c: 'blue' },
          { l: 'Network Health', v: '92%', sub: '6 of 8 active', c: 'green' },
          { l: 'Total ONUs', v: '1,024', sub: '896 registered', c: 'indigo' },
          { l: 'Issues', v: '2', sub: 'Needs attention', c: 'red' },
        ].map(s => (
          <div key={s.l} className="bg-white/3 border border-white/6 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 mb-1">{s.l}</p>
            <p className={`text-lg font-bold ${s.c === 'green' ? 'text-green-400' : s.c === 'red' ? 'text-red-400' : s.c === 'indigo' ? 'text-indigo-400' : 'text-blue-400'}`}>{s.v}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
      {/* OLT list */}
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">All OLT Devices</span>
          <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">8 devices</span>
        </div>
        {[
          { name: 'Main-OLT-01', ip: '103.115.198.1', onus: 256, reg: 248, status: 'active', user: 'admin' },
          { name: 'Branch-OLT-02', ip: '192.168.2.1', onus: 128, reg: 120, status: 'active', user: 'ali_isp' },
          { name: 'Tower-OLT-03', ip: '10.10.5.1', onus: 64, reg: 58, status: 'active', user: 'noman' },
          { name: 'Remote-OLT-04', ip: '172.16.0.1', onus: 32, reg: 0, status: 'error', user: 'hassan' },
        ].map(o => (
          <div key={o.name} className="flex items-center justify-between px-4 py-2.5 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Server className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#0d1117] ${o.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-gray-200">{o.name}</p>
                  <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">{o.user}</span>
                </div>
                <p className="text-[10px] text-gray-600 font-mono">{o.ip}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-gray-500">{o.onus} ONUs • {o.reg} reg</span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${o.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {o.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupScreen() {
  const logs = [
    { level: 'info', step: 'Init', msg: 'Starting OLT setup for Main-OLT-01 (103.115.198.1)', t: '00:00' },
    { level: 'success', step: 'SNMP', msg: 'SNMP read access verified — sysDescr: Huawei MA5800-X17', t: '00:02' },
    { level: 'success', step: 'SNMP', msg: 'System uptime: 47 days, 3:12:05', t: '00:02' },
    { level: 'success', step: 'Ports', msg: 'Discovered 8 PON ports, 2 uplink ports', t: '00:04' },
    { level: 'success', step: 'VLANs', msg: 'Synced 24 VLANs from OLT (SNMP method)', t: '00:06' },
    { level: 'success', step: 'Profiles', msg: 'Discovered 4 line profiles, 3 service profiles', t: '00:08' },
    { level: 'success', step: 'Telnet', msg: 'Telnet login successful — admin@103.115.198.1:23', t: '00:09' },
    { level: 'success', step: 'Done', msg: 'Setup complete — OLT is now active', t: '00:11' },
  ];
  const levelColor: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  };
  return (
    <div className="p-5 space-y-4">
      {/* Progress steps */}
      <div className="flex items-center justify-between px-2">
        {['SNMP Read', 'Port Discovery', 'VLAN Sync', 'Profile Sync', 'Telnet Login', 'Complete'].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 text-[10px] font-medium ${i < 6 ? 'text-green-400' : 'text-gray-600'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${i < 6 ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5 border border-white/10'}`}>
                {i < 6 ? <CheckCircle className="h-2.5 w-2.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />}
              </div>
              <span className="hidden md:block">{s}</span>
            </div>
            {i < 5 && <div className="w-4 h-px bg-green-500/30 mx-1" />}
          </div>
        ))}
      </div>
      {/* Log terminal */}
      <div className="bg-[#010b14] border border-white/8 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/2">
          <Terminal className="h-3.5 w-3.5 text-green-400" />
          <span className="text-[11px] text-gray-400 font-mono">Setup Logs — Main-OLT-01</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Complete
          </span>
        </div>
        <div className="p-3 space-y-1.5 font-mono text-[11px]">
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-gray-700 shrink-0">{l.t}</span>
              <span className={`shrink-0 w-14 ${levelColor[l.level]}`}>[{l.step}]</span>
              <span className="text-gray-300">{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 px-2 py-3 bg-green-500/8 border border-green-500/20 rounded-xl">
        <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
        <span className="text-xs text-green-300 font-medium">OLT setup completed successfully in 11 seconds. Device is now active.</span>
      </div>
    </div>
  );
}

function ONUScreen() {
  const onus = [
    { sn: 'HWTC1A2B3C4D', mac: 'A4:82:47:1A:2B:3C', port: 'GPON 0/1/0', status: 'unregistered' },
    { sn: 'HWTC5E6F7A8B', mac: 'B0:4E:26:5E:6F:7A', port: 'GPON 0/1/0', status: 'registered' },
    { sn: 'HWTCAB12CD34', mac: 'C8:3A:35:AB:12:CD', port: 'GPON 0/1/1', status: 'registered' },
    { sn: 'HWTCEF56GH78', mac: 'D4:61:9D:EF:56:01', port: 'GPON 0/1/1', status: 'unregistered' },
    { sn: 'HWTCIJ90KL12', mac: 'E8:75:40:IJ:90:KL', port: 'GPON 0/1/2', status: 'active' },
  ];
  return (
    <div className="p-5 space-y-3">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white/3 rounded-lg p-1 w-fit">
        {['All', 'Unregistered', 'Registered', 'Active'].map((f, i) => (
          <button key={f} className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${i === 1 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{f}</button>
        ))}
      </div>
      {/* ONU table */}
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <span className="col-span-1" />
          <span className="col-span-3">Serial Number</span>
          <span className="col-span-3">MAC Address</span>
          <span className="col-span-2">PON Port</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-1" />
        </div>
        {onus.map(o => (
          <div key={o.sn} className="grid grid-cols-12 items-center px-4 py-2.5 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
            <div className="col-span-1">
              <div className={`w-4 h-4 rounded border ${o.status === 'unregistered' ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/5'} flex items-center justify-center`}>
                {o.status === 'unregistered' && <div className="w-2 h-2 rounded-sm bg-blue-500" />}
              </div>
            </div>
            <span className="col-span-3 text-[11px] font-mono text-gray-300">{o.sn}</span>
            <span className="col-span-3 text-[11px] font-mono text-gray-500">{o.mac}</span>
            <span className="col-span-2 text-[11px] text-gray-400">{o.port}</span>
            <span className="col-span-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                o.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                o.status === 'registered' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>{o.status}</span>
            </span>
            <div className="col-span-1 flex justify-end">
              {o.status === 'unregistered' && (
                <button className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md hover:bg-blue-500/20 transition-colors">
                  Register
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Bulk action bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl">
        <span className="text-xs text-blue-300 font-medium">2 ONUs selected</span>
        <div className="ml-auto flex items-center gap-2">
          <select className="text-[11px] bg-white/5 border border-white/10 text-gray-300 rounded-lg px-2 py-1">
            <option>VLAN 100 — Internet</option>
          </select>
          <button className="text-[11px] font-bold text-white bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-500 transition-colors">
            Bulk Register
          </button>
        </div>
      </div>
    </div>
  );
}

function VLANScreen() {
  const vlans = [
    { id: 100, name: 'Internet', onus: 48, source: 'managed', pushed: true },
    { id: 200, name: 'IPTV', onus: 12, source: 'managed', pushed: true },
    { id: 300, name: 'VoIP', onus: 8, source: 'discovered', pushed: false },
    { id: 400, name: 'Management', onus: 0, source: 'discovered', pushed: false },
    { id: 500, name: 'Guest-WiFi', onus: 5, source: 'managed', pushed: true },
  ];
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">5 VLANs</span>
          <span className="text-[10px] text-gray-600">•</span>
          <span className="text-[10px] text-green-400">3 pushed</span>
          <span className="text-[10px] text-gray-600">•</span>
          <span className="text-[10px] text-amber-400">2 discovered</span>
        </div>
        <button className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg">
          + Sync from OLT
        </button>
      </div>
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <span className="col-span-1">ID</span>
          <span className="col-span-3">Name</span>
          <span className="col-span-2">ONUs</span>
          <span className="col-span-3">Source</span>
          <span className="col-span-3">Status</span>
        </div>
        {vlans.map(v => (
          <div key={v.id} className="grid grid-cols-12 items-center px-4 py-2.5 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
            <span className="col-span-1 text-[11px] font-mono text-blue-400 font-bold">{v.id}</span>
            <span className="col-span-3 text-[11px] text-gray-200 font-medium">{v.name}</span>
            <span className="col-span-2 text-[11px] text-gray-500">{v.onus} ONUs</span>
            <span className="col-span-3">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${v.source === 'managed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                {v.source === 'managed' ? <Layers className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                {v.source}
              </span>
            </span>
            <span className="col-span-3 flex items-center gap-2">
              {v.pushed ? (
                <span className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Pushed</span>
              ) : (
                <button className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  Push to OLT
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketScreen() {
  return (
    <div className="p-5 grid grid-cols-5 gap-4 h-full">
      {/* Ticket list */}
      <div className="col-span-2 space-y-2">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">All Tickets</div>
        {[
          { id: 12, sub: 'ONU not registering on port 0/1/3', user: 'ali_isp', status: 'open', time: '2h ago' },
          { id: 11, sub: 'VLAN 300 not pushing to OLT', user: 'noman', status: 'answered', time: '5h ago' },
          { id: 10, sub: 'Setup stuck at Telnet Login step', user: 'hassan', status: 'closed', time: '1d ago' },
        ].map(t => (
          <div key={t.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${t.id === 12 ? 'bg-blue-500/8 border-blue-500/30' : 'bg-white/2 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${t.status === 'open' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : t.status === 'answered' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                {t.status}
              </span>
              <span className="text-[10px] text-gray-600 ml-auto">{t.time}</span>
            </div>
            <p className="text-[11px] text-gray-300 font-medium leading-snug">#{t.id} — {t.sub}</p>
            <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1"><User className="h-2.5 w-2.5" />{t.user}</p>
          </div>
        ))}
      </div>

      {/* Ticket detail */}
      <div className="col-span-3 bg-white/2 border border-white/5 rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">open</span>
            <span className="text-[10px] text-gray-600 font-mono">#12</span>
          </div>
          <p className="text-xs font-bold text-white">ONU not registering on port 0/1/3</p>
          <p className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1"><User className="h-2.5 w-2.5" />ali_isp • OLT: Main-OLT-01</p>
        </div>
        <div className="flex-1 p-3 space-y-2 overflow-auto">
          <div className="bg-white/3 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[9px] font-bold text-blue-400">AL</div>
              <span className="text-[10px] font-semibold text-gray-300">ali_isp</span>
              <span className="text-[10px] text-gray-600 ml-auto">2h ago</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">I'm trying to register an ONU on GPON port 0/1/3 but it keeps failing. Serial is HWTC1A2B3C4D. I tried 3 times already.</p>
          </div>
          <div className="bg-indigo-500/6 border border-indigo-500/15 rounded-lg p-2.5 ml-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Shield className="h-3 w-3 text-indigo-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-300">Admin</span>
              <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 rounded-full border border-indigo-500/20">Staff</span>
              <span className="text-[10px] text-gray-600 ml-auto">1h ago</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">Please check if the line profile is correctly synced. Go to OLT detail → Sync Profiles, then try registering again.</p>
          </div>
        </div>
        <div className="p-3 border-t border-white/5">
          <div className="bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-[11px] text-gray-600">
            Write a reply...
          </div>
        </div>
      </div>
    </div>
  );
}

const screens: Record<string, React.ReactNode> = {
  dashboard: <DashboardScreen />,
  setup: <SetupScreen />,
  onus: <ONUScreen />,
  vlans: <VLANScreen />,
  tickets: <TicketScreen />,
};

export default function Screenshots() {
  const [active, setActive] = useState('dashboard');

  return (
    <section id="preview" className="py-28 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-indigo-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-4">
            Platform Preview
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            See every screen
            <br />
            <span className="gradient-text">of the platform</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From dashboard to support tickets — Auto OLT gives you complete visibility and control over your entire GPON network.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-center gap-1 mb-6 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active === t.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Mockup window */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-violet-600/20 rounded-2xl blur-xl" />
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d1117]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="ml-3 flex-1 bg-[#0d1117] rounded-md px-3 py-1 text-xs text-gray-500 font-mono">
                autoolt.app/{active}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-gray-500">Live</span>
              </div>
            </div>

            {/* Sidebar + content layout */}
            <div className="flex" style={{ minHeight: '420px' }}>
              {/* Mini sidebar */}
              <div className="w-44 shrink-0 bg-[#0a0f1a] border-r border-white/5 flex flex-col py-4">
                <div className="flex items-center gap-2 px-4 mb-6">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Wifi className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-white">Auto OLT</span>
                </div>
                {[
                  { id: 'dashboard', icon: Server, label: 'Dashboard' },
                  { id: 'onus', icon: Wifi, label: 'OLT Devices' },
                  { id: 'tickets', icon: LifeBuoy, label: 'Support' },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = active === item.id || (item.id === 'onus' && (active === 'setup' || active === 'onus' || active === 'vlans'));
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActive(item.id)}
                      className={`flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-[11px] font-medium transition-all ${isActive ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'}`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Screen content */}
              <div className="flex-1 overflow-auto">
                {screens[active]}
              </div>
            </div>
          </div>
        </div>

        {/* Caption */}
        <p className="text-center text-sm text-gray-600 mt-4">
          Click the tabs above to explore different screens
        </p>
      </div>
    </section>
  );
}
