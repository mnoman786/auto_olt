'use client';
import { useState } from 'react';
import {
  Wifi, CheckCircle, Layers, LifeBuoy,
  Terminal, AlertCircle, Server, Users,
  MonitorPlay, BarChart3, Bell, UserCheck,
  Activity, Shield, User, TrendingUp, TrendingDown,
} from 'lucide-react';

const tabs = [
  { id: 'dashboard',  label: 'Dashboard',    icon: Server },
  { id: 'onus',       label: 'ONUs',         icon: Wifi },
  { id: 'customers',  label: 'Customers',    icon: UserCheck },
  { id: 'bandwidth',  label: 'Bandwidth',    icon: BarChart3 },
  { id: 'noc',        label: 'NOC View',     icon: MonitorPlay },
  { id: 'alerts',     label: 'Alerts',       icon: Bell },
  { id: 'tickets',    label: 'Support',      icon: LifeBuoy },
];

/* ── Dashboard ─────────────────────────────────────────────────── */
function DashboardScreen() {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { l: 'Total OLTs',     v: '8',     sub: '6 online',       c: 'blue'  },
          { l: 'Network Health', v: '94%',   sub: '6 of 8 active',  c: 'green' },
          { l: 'Total ONUs',     v: '1,024', sub: '896 registered', c: 'indigo'},
          { l: 'Alerts',         v: '2',     sub: 'Needs attention', c: 'red'  },
        ].map(s => (
          <div key={s.l} className="bg-white/3 border border-white/6 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 mb-1">{s.l}</p>
            <p className={`text-xl font-bold ${s.c === 'green' ? 'text-green-400' : s.c === 'red' ? 'text-red-400' : s.c === 'indigo' ? 'text-indigo-400' : 'text-blue-400'}`}>{s.v}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">OLT Devices</span>
          <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">8 devices</span>
        </div>
        {[
          { name: 'Main-OLT-01',   ip: '103.115.198.1', onus: 256, reg: 248, status: 'active'   },
          { name: 'Branch-OLT-02', ip: '192.168.2.1',   onus: 128, reg: 120, status: 'active'   },
          { name: 'Tower-OLT-03',  ip: '10.10.5.1',     onus: 64,  reg: 58,  status: 'active'   },
          { name: 'Remote-OLT-04', ip: '172.16.0.1',    onus: 32,  reg: 0,   status: 'error'    },
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
                <p className="text-xs font-medium text-gray-200">{o.name}</p>
                <p className="text-[10px] text-gray-600 font-mono">{o.ip}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-gray-500">{o.onus} ONUs · {o.reg} reg</span>
              <span className={`px-2 py-0.5 rounded-full font-semibold border ${o.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {o.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ONU Management ─────────────────────────────────────────────── */
function ONUScreen() {
  const onus = [
    { sn: 'HWTC1A2B3C4D', port: 'GPON 0/1/0', status: 'unregistered', customer: null,           signal: null      },
    { sn: 'HWTC5E6F7A8B', port: 'GPON 0/1/0', status: 'active',        customer: 'Ali Hassan',   signal: -18.4     },
    { sn: 'HWTCAB12CD34', port: 'GPON 0/1/1', status: 'active',        customer: 'Noman Farooq', signal: -21.1     },
    { sn: 'HWTCEF56GH78', port: 'GPON 0/1/1', status: 'unregistered', customer: null,            signal: null      },
    { sn: 'ZTEG7C8D9E0F', port: 'GPON 0/1/2', status: 'offline',       customer: 'Bilal Tariq',  signal: -29.8     },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-1.5 bg-white/3 rounded-lg p-1 w-fit">
        {['All', 'Unregistered', 'Active', 'Offline'].map((f, i) => (
          <button key={f} className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${i === 0 ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{f}</button>
        ))}
      </div>
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <span className="col-span-3">Serial</span>
          <span className="col-span-2">Port</span>
          <span className="col-span-2">Signal</span>
          <span className="col-span-3">Subscriber</span>
          <span className="col-span-2">Status</span>
        </div>
        {onus.map(o => (
          <div key={o.sn} className="grid grid-cols-12 items-center px-4 py-2.5 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
            <span className="col-span-3 text-[11px] font-mono text-gray-300">{o.sn}</span>
            <span className="col-span-2 text-[11px] text-gray-500">{o.port}</span>
            <span className="col-span-2 text-[11px] font-mono">
              {o.signal !== null
                ? <span className={o.signal >= -25 ? 'text-green-400' : 'text-red-400'}>{o.signal} dBm</span>
                : <span className="text-gray-600">—</span>}
            </span>
            <span className="col-span-3 text-[11px]">
              {o.customer
                ? <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">{o.customer[0]}</span><span className="text-gray-300 truncate">{o.customer}</span></span>
                : <span className="text-gray-600">—</span>}
            </span>
            <span className="col-span-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                o.status === 'active'       ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                o.status === 'offline'      ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                              'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>{o.status}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Customers ──────────────────────────────────────────────────── */
function CustomersScreen() {
  const customers = [
    { name: 'Ali Hassan',    phone: '0311-1234567', plan: '10 Mbps',  onu: 'HWTC5E6F7A8B', status: 'active'  },
    { name: 'Noman Farooq',  phone: '0321-7654321', plan: '20 Mbps',  onu: 'HWTCAB12CD34', status: 'active'  },
    { name: 'Bilal Tariq',   phone: '0333-1122334', plan: '5 Mbps',   onu: 'ZTEG7C8D9E0F', status: 'offline' },
    { name: 'Sara Ahmed',    phone: '0300-9988776', plan: '50 Mbps',  onu: null,            status: null      },
    { name: 'Usman Malik',   phone: '0345-5566778', plan: '10 Mbps',  onu: 'CDATABC123456', status: 'active'  },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="bg-white/3 border border-white/8 rounded-lg px-3 py-1.5 text-[11px] text-gray-500 flex items-center gap-2 w-48">
          <span>🔍</span> Search subscribers...
        </div>
        <button className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg">
          + Add Customer
        </button>
      </div>
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <span className="col-span-3">Name</span>
          <span className="col-span-3">Phone</span>
          <span className="col-span-2">Plan</span>
          <span className="col-span-3">ONU</span>
          <span className="col-span-1">Status</span>
        </div>
        {customers.map(c => (
          <div key={c.name} className="grid grid-cols-12 items-center px-4 py-2.5 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
            <div className="col-span-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0">{c.name[0]}</div>
              <span className="text-[11px] text-gray-200 font-medium truncate">{c.name}</span>
            </div>
            <span className="col-span-3 text-[11px] text-gray-500 font-mono">{c.phone}</span>
            <span className="col-span-2">
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-medium">{c.plan}</span>
            </span>
            <span className="col-span-3 text-[11px] font-mono text-gray-500 truncate">
              {c.onu ?? <span className="text-amber-500/70 text-[10px]">Unassigned</span>}
            </span>
            <span className="col-span-1">
              {c.status === 'active'  && <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
              {c.status === 'offline' && <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />}
              {!c.status              && <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Bandwidth ──────────────────────────────────────────────────── */
function BandwidthScreen() {
  const bars = [
    { t: '00:00', rx: 45,  tx: 30 },
    { t: '04:00', rx: 20,  tx: 12 },
    { t: '08:00', rx: 65,  tx: 50 },
    { t: '12:00', rx: 88,  tx: 70 },
    { t: '16:00', rx: 95,  tx: 82 },
    { t: '20:00', rx: 78,  tx: 60 },
    { t: '23:59', rx: 50,  tx: 38 },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { l: 'Peak Rx',     v: '950 Mbps', icon: TrendingDown, c: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { l: 'Peak Tx',     v: '820 Mbps', icon: TrendingUp,   c: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20'  },
          { l: 'Avg Util.',   v: '68%',      icon: Activity,     c: 'text-indigo-400',bg: 'bg-indigo-500/10 border-indigo-500/20'},
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.l} className={`border rounded-xl p-3 flex items-center gap-3 ${s.bg}`}>
              <Icon className={`h-5 w-5 ${s.c} shrink-0`} />
              <div>
                <p className="text-[10px] text-gray-500">{s.l}</p>
                <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Chart */}
      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Bandwidth — Last 24h (Main-OLT-01)</span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />Rx</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Tx</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-24">
          {bars.map((b) => (
            <div key={b.t} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex gap-0.5 items-end h-20">
                <div className="flex-1 rounded-t bg-green-500/30 border-t border-green-500/50" style={{ height: `${b.rx}%` }} />
                <div className="flex-1 rounded-t bg-blue-500/30 border-t border-blue-500/50"  style={{ height: `${b.tx}%` }} />
              </div>
              <span className="text-[9px] text-gray-600">{b.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── NOC View ───────────────────────────────────────────────────── */
function NOCScreen() {
  const olts = [
    { name: 'Main-OLT-01',   onus: 256, active: 248, status: 'online',  signal: -18 },
    { name: 'Branch-OLT-02', onus: 128, active: 120, status: 'online',  signal: -21 },
    { name: 'Tower-OLT-03',  onus: 64,  active: 64,  status: 'online',  signal: -17 },
    { name: 'Remote-OLT-04', onus: 32,  active: 0,   status: 'offline', signal: null },
    { name: 'East-OLT-05',   onus: 96,  active: 90,  status: 'online',  signal: -22 },
    { name: 'West-OLT-06',   onus: 48,  active: 45,  status: 'online',  signal: -19 },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] text-green-400 font-semibold">LIVE</span>
          <span className="text-[10px] text-gray-600">NOC Dashboard — Auto-refresh 30s</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">5 Online</span>
          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">1 Offline</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {olts.map(o => (
          <div key={o.name} className={`rounded-xl border p-3 ${o.status === 'offline' ? 'bg-red-500/5 border-red-500/20' : 'bg-white/2 border-white/8'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${o.status === 'online' ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
              <span className="text-[11px] font-semibold text-gray-200 truncate">{o.name}</span>
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-600">ONUs</span>
                <span className={o.status === 'offline' ? 'text-red-400' : 'text-gray-300'}>{o.active}/{o.onus}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1">
                <div className={`h-1 rounded-full ${o.status === 'offline' ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${(o.active / o.onus) * 100}%` }} />
              </div>
              {o.signal && <div className="flex justify-between"><span className="text-gray-600">Signal</span><span className={o.signal >= -25 ? 'text-green-400' : 'text-amber-400'}>{o.signal} dBm</span></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Alerts ─────────────────────────────────────────────────────── */
function AlertsScreen() {
  const events = [
    { type: 'ONU Offline',    olt: 'Remote-OLT-04', onu: 'HWTCEF56GH78', time: '5m ago',  sev: 'high'   },
    { type: 'Signal Degraded',olt: 'Tower-OLT-03',  onu: 'ZTEG7C8D9E0F', time: '18m ago', sev: 'medium' },
    { type: 'ONU Offline',    olt: 'Main-OLT-01',   onu: 'HWTC1A2B3C4D', time: '1h ago',  sev: 'high'   },
    { type: 'ONU Online',     olt: 'Branch-OLT-02', onu: 'CDATABC123456', time: '2h ago', sev: 'ok'     },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Active Alerts', v: '3', c: 'text-red-400',   bg: 'bg-red-500/8 border-red-500/20'     },
          { l: 'Today',         v: '7', c: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20' },
          { l: 'Rules Active',  v: '5', c: 'text-blue-400',  bg: 'bg-blue-500/8 border-blue-500/20'   },
        ].map(s => (
          <div key={s.l} className={`border rounded-xl p-3 ${s.bg}`}>
            <p className="text-[10px] text-gray-500 mb-0.5">{s.l}</p>
            <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-white/5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Recent Events</div>
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/3 last:border-0 hover:bg-white/2 transition-colors">
            <AlertCircle className={`h-4 w-4 shrink-0 ${e.sev === 'high' ? 'text-red-400' : e.sev === 'medium' ? 'text-amber-400' : 'text-green-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-200">{e.type}</p>
              <p className="text-[10px] text-gray-600 font-mono truncate">{e.olt} · {e.onu}</p>
            </div>
            <span className="text-[10px] text-gray-600 shrink-0">{e.time}</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
              e.sev === 'high'   ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              e.sev === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                   'bg-green-500/10 text-green-400 border-green-500/20'
            }`}>{e.sev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Support Tickets ────────────────────────────────────────────── */
function TicketScreen() {
  return (
    <div className="p-4 grid grid-cols-5 gap-3" style={{ minHeight: '340px' }}>
      <div className="col-span-2 space-y-2">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">All Tickets</div>
        {[
          { id: 12, sub: 'ONU not registering on port 0/1/3', status: 'open',     time: '2h ago' },
          { id: 11, sub: 'VLAN 300 not pushing to OLT',       status: 'answered', time: '5h ago' },
          { id: 10, sub: 'Setup stuck at Telnet Login step',   status: 'closed',   time: '1d ago' },
        ].map(t => (
          <div key={t.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${t.id === 12 ? 'bg-blue-500/8 border-blue-500/30' : 'bg-white/2 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${t.status === 'open' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : t.status === 'answered' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                {t.status}
              </span>
              <span className="text-[10px] text-gray-600 ml-auto">{t.time}</span>
            </div>
            <p className="text-[11px] text-gray-300 font-medium leading-snug">#{t.id} — {t.sub}</p>
          </div>
        ))}
      </div>
      <div className="col-span-3 bg-white/2 border border-white/5 rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">open</span>
            <span className="text-[10px] text-gray-600 font-mono">#12</span>
          </div>
          <p className="text-xs font-bold text-white">ONU not registering on port 0/1/3</p>
          <p className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-1"><User className="h-2.5 w-2.5" />ali_isp · Main-OLT-01</p>
        </div>
        <div className="flex-1 p-3 space-y-2">
          <div className="bg-white/3 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[9px] font-bold text-blue-400">AL</div>
              <span className="text-[10px] font-semibold text-gray-300">ali_isp</span>
              <span className="text-[10px] text-gray-600 ml-auto">2h ago</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">Trying to register ONU on GPON port 0/1/3 but it keeps failing. Serial is HWTC1A2B3C4D.</p>
          </div>
          <div className="bg-indigo-500/6 border border-indigo-500/15 rounded-lg p-2.5 ml-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="h-4 w-4 text-indigo-400" />
              <span className="text-[10px] font-semibold text-gray-300">Support</span>
              <span className="text-[10px] text-gray-600 ml-auto">1h ago</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">Please sync profiles first from OLT detail page, then retry registration.</p>
          </div>
        </div>
        <div className="p-3 border-t border-white/5">
          <div className="bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-[11px] text-gray-600">Write a reply...</div>
        </div>
      </div>
    </div>
  );
}

const screens: Record<string, React.ReactNode> = {
  dashboard: <DashboardScreen />,
  onus:      <ONUScreen />,
  customers: <CustomersScreen />,
  bandwidth: <BandwidthScreen />,
  noc:       <NOCScreen />,
  alerts:    <AlertsScreen />,
  tickets:   <TicketScreen />,
};

const sidebarItems = [
  { id: 'dashboard', icon: Server,    label: 'Dashboard' },
  { id: 'onus',      icon: Wifi,      label: 'OLT Devices' },
  { id: 'customers', icon: Users,     label: 'Customers' },
  { id: 'alerts',    icon: Bell,      label: 'Alerts' },
  { id: 'noc',       icon: MonitorPlay, label: 'NOC View' },
  { id: 'tickets',   icon: LifeBuoy,  label: 'Support' },
];

export default function Screenshots() {
  const [active, setActive] = useState('dashboard');

  return (
    <section id="preview" className="py-28 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-indigo-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-4">
            Platform Preview
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            See every screen
            <span className="gradient-text"> of the platform</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            From live NOC dashboards to subscriber management — explore the full platform before you sign up.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-center gap-1 mb-5 flex-wrap">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active === t.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
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
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-gray-500">Live</span>
              </div>
            </div>

            {/* Sidebar + content */}
            <div className="flex" style={{ minHeight: '400px' }}>
              {/* Mini sidebar */}
              <div className="w-40 shrink-0 bg-[#0a0f1a] border-r border-white/5 py-4">
                <div className="flex items-center gap-2 px-3 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Wifi className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-white">Auto OLT</span>
                </div>
                <div className="space-y-0.5 px-2">
                  {sidebarItems.map(item => {
                    const Icon = item.icon;
                    const isActive = active === item.id ||
                      (item.id === 'onus' && active === 'onus') ||
                      (item.id === 'bandwidth' && active === 'bandwidth');
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActive(item.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-600/80 to-indigo-600/80 text-white'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Screen content */}
              <div className="flex-1 overflow-auto">
                {screens[active]}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          Click the tabs above to explore different screens
        </p>
      </div>
    </section>
  );
}
