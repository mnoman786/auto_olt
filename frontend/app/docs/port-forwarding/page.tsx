'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { useState } from 'react';
import {
  Router, Server, CheckCircle2, Copy, Check,
  ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, Monitor, Layers
} from 'lucide-react';
import { clsx } from 'clsx';

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-2">
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
      >
        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, color, children, defaultOpen = true }: {
  title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="mb-4">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900 text-left">{title}</h2>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="mt-4 space-y-3 text-sm text-gray-700">{children}</div>}
    </Card>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
        {num}
      </div>
      <div className="flex-1 pb-4 border-b border-gray-100 last:border-0">
        <p className="font-medium text-gray-900 mb-2">{title}</p>
        <div className="text-gray-600 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Note({ type = 'info', children }: { type?: 'info' | 'warn'; children: React.ReactNode }) {
  return (
    <div className={clsx(
      'flex items-start gap-2 p-3 rounded-lg text-sm',
      type === 'warn' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-blue-50 border border-blue-200 text-blue-800'
    )}>
      {type === 'warn'
        ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{children}</span>
    </div>
  );
}

export default function PortForwardingDocsPage() {
  return (
    <AppLayout>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-amber-50/70 via-orange-50/40 to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-4xl mx-auto">
        <Link href="/docs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </Link>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-50 to-orange-100 flex items-center justify-center text-orange-600 shadow-sm shrink-0">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600/80">Guide</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">MikroTik Port Forwarding</h1>
            <p className="text-gray-500 text-sm">
              Forward OLT ports (SNMP / Telnet) through a MikroTik router so Auto OLT can reach your OLT.
            </p>
          </div>
        </div>

        {/* When to use this */}
        <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Use this method when:
            </p>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• You have a MikroTik router with a public IP</li>
              <li>• OLT sits behind the MikroTik on the LAN</li>
              <li>• ISP gives you a static IP</li>
              <li>• You want the simplest setup without VPN</li>
            </ul>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Not suitable when:
            </p>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• MikroTik is behind double NAT (CGNAT)</li>
              <li>• ISP blocks inbound ports</li>
              <li>• You only have a dynamic IP</li>
              <li>• No public IP at all</li>
            </ul>
          </div>
        </div>

        {/* Architecture */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How it works</p>
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            {[
              { icon: Monitor, label: 'OLT Device', sub: '192.168.1.1 (LAN)', color: 'bg-orange-100 text-orange-600' },
              { label: '→', color: '' },
              { icon: Router, label: 'MikroTik', sub: 'Port Forwarding', color: 'bg-purple-100 text-purple-600' },
              { label: '→ Internet →', color: '' },
              { icon: Server, label: 'Auto OLT Server', sub: '162.217.248.75', color: 'bg-blue-100 text-blue-600' },
            ].map((item, i) => (
              item.icon ? (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                  <div>
                    <p className="font-medium text-xs">{item.label}</p>
                    <p className="text-xs opacity-75">{item.sub}</p>
                  </div>
                </div>
              ) : (
                <span key={i} className="text-gray-400 font-mono text-xs">{item.label}</span>
              )
            ))}
          </div>
        </div>

        {/* MikroTik Port Forwarding */}
        <Section title="MikroTik Router — Port Forwarding Setup" icon={Layers} color="bg-orange-500">
          <Note>Step-by-step guide for forwarding OLT ports on a MikroTik router using Winbox or CLI.</Note>

          {/* Winbox method */}
          <div className="mt-2">
            <p className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold">Method A</span>
              Using Winbox (GUI)
            </p>
            <div className="space-y-6">
              <Step num={1} title="Open IP → Firewall → NAT">
                <p>In Winbox: go to <strong>IP</strong> → <strong>Firewall</strong> → tab <strong>NAT</strong> → click <strong>+</strong> to add a rule.</p>
              </Step>

              <Step num={2} title="Forward SNMP — UDP 161">
                <p>Fill in the <strong>General</strong> tab:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs mt-2">
                  <div className="flex justify-between"><span className="text-gray-500">Chain:</span><span>dstnat</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Protocol:</span><span>udp</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Dst. Port:</span><span>161</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">In. Interface:</span><span className="text-blue-600">ether1 (WAN interface)</span></div>
                </div>
                <p className="mt-2">Switch to the <strong>Action</strong> tab:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs mt-1">
                  <div className="flex justify-between"><span className="text-gray-500">Action:</span><span>dst-nat</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">To Addresses:</span><span className="text-blue-600">{'<OLT LAN IP e.g. 192.168.1.1>'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">To Ports:</span><span>161</span></div>
                </div>
                <p className="mt-1">Click <strong>OK</strong>.</p>
              </Step>

              <Step num={3} title="Forward Telnet — TCP 23">
                <p>Add another NAT rule. <strong>General</strong> tab:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs mt-2">
                  <div className="flex justify-between"><span className="text-gray-500">Chain:</span><span>dstnat</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Protocol:</span><span>tcp</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Dst. Port:</span><span>23</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">In. Interface:</span><span className="text-blue-600">ether1 (WAN interface)</span></div>
                </div>
                <p className="mt-2"><strong>Action</strong> tab:</p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs mt-1">
                  <div className="flex justify-between"><span className="text-gray-500">Action:</span><span>dst-nat</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">To Addresses:</span><span className="text-blue-600">{'<OLT LAN IP e.g. 192.168.1.1>'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">To Ports:</span><span>23</span></div>
                </div>
                <Note type="warn">If port 23 is blocked by your ISP, set Dst. Port to 2323 and To Ports to 23. Then enter 2323 as Telnet Port in Auto OLT.</Note>
              </Step>

              <Step num={4} title="Disable MikroTik Telnet service on port 23 (important!)">
                <p>By default MikroTik itself listens on port 23. Forwarding port 23 inbound will hit the router, not the OLT.</p>
                <p className="mt-1">Go to <strong>IP</strong> → <strong>Services</strong> → find <strong>telnet</strong> → either <strong>Disable</strong> it or change its port to something else (e.g. 2222).</p>
                <Note type="warn">Skip this step and port 23 will connect you to the MikroTik router instead of the OLT.</Note>
              </Step>
            </div>
          </div>

          {/* CLI method */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded-full font-bold">Method B</span>
              Using CLI / Terminal
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Forward UDP 161 (SNMP) to OLT:</p>
                <CodeBlock code={`/ip firewall nat add chain=dstnat protocol=udp dst-port=161 \\\n  in-interface=ether1 action=dst-nat \\\n  to-addresses=192.168.1.1 to-ports=161`} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Forward TCP 23 (Telnet) to OLT:</p>
                <CodeBlock code={`/ip firewall nat add chain=dstnat protocol=tcp dst-port=23 \\\n  in-interface=ether1 action=dst-nat \\\n  to-addresses=192.168.1.1 to-ports=23`} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Disable MikroTik's own Telnet service:</p>
                <CodeBlock code={`/ip service set telnet disabled=yes`} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Verify rules were added:</p>
                <CodeBlock code={`/ip firewall nat print`} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Step num={5} title="Add OLT in Auto OLT">
              <p>Go to <strong>Add OLT</strong> → select <strong>Connection Type: Direct (Public IP)</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">IP Address:</span><span className="text-blue-600">{'<MikroTik WAN/public IP>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Connection Type:</span><span>Direct (Public IP)</span></div>
              </div>
            </Step>

            <Step num={6} title="Test SNMP from the server">
              <p>SSH into your Auto OLT server and run:</p>
              <CodeBlock code={`snmpget -v2c -c public <mikrotik_public_ip> 1.3.6.1.2.1.1.1.0`} />
              <p>If it returns a value, SNMP is working correctly.</p>
            </Step>
          </div>
        </Section>

        {/* Troubleshooting */}
        <Section title="Troubleshooting" icon={AlertTriangle} color="bg-red-500" defaultOpen={false}>
          <div className="space-y-4">
            {[
              {
                problem: 'SNMP connectivity fails',
                solutions: [
                  'Verify UDP port 161 is forwarded to the OLT in MikroTik NAT rules',
                  'Check OLT SNMP is enabled and community string is correct',
                  'Test: snmpget -v2c -c <community> <ip> 1.3.6.1.2.1.1.1.0 from server',
                  'Check OLT firewall is not blocking UDP 161',
                ]
              },
              {
                problem: 'Telnet connection refused',
                solutions: [
                  'Verify TCP port 23 is forwarded to the OLT in MikroTik NAT rules',
                  'Make sure MikroTik\'s own Telnet service is disabled (or moved to a different port)',
                  'Check Telnet is enabled on the OLT',
                  'Try: telnet <mikrotik_public_ip> 23 from server',
                  'If ISP blocks port 23, use a different external port (e.g. 2323)',
                ]
              },
              {
                problem: 'Port forwarding set up but still cannot connect',
                solutions: [
                  'Your ISP may be using CGNAT — check if MikroTik WAN IP matches whatismyip.com',
                  'Some ISPs block inbound connections on port 23 and 161',
                  'Try the WireGuard VPN method instead — it works behind any NAT',
                ]
              },
            ].map(({ problem, solutions }, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4">
                <p className="font-medium text-red-600 mb-2">❌ {problem}</p>
                <ul className="space-y-1">
                  {solutions.map((s, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-indigo-800 text-sm">Port forwarding not working?</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              Consider using the{' '}
              <Link href="/docs/wireguard" className="underline font-medium">WireGuard VPN method</Link>
              {' '}— it works behind any NAT, CGNAT, or firewall without requiring port forwarding.
            </p>
          </div>
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
