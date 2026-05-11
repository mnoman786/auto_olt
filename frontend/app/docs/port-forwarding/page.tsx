'use client';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { useState } from 'react';
import {
  Globe, Router, Server, CheckCircle2, Copy, Check,
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
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-2">
          <Link href="/docs" className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 mb-4">
            <ArrowLeft className="h-3 w-3" /> Back to Documentation
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Public IP / Port Forwarding Setup</h1>
          </div>
          <p className="text-gray-500 ml-14">
            Connect your OLT directly to Auto OLT using a public IP or port forwarding — no VPN required.
          </p>
        </div>

        {/* When to use this */}
        <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Use this method when:
            </p>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• OLT has a public/static IP address</li>
              <li>• Your router supports port forwarding</li>
              <li>• ISP gives you a static IP</li>
              <li>• You want the simplest setup</li>
            </ul>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Not suitable when:
            </p>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• OLT is behind double NAT (CGNAT)</li>
              <li>• ISP blocks inbound ports</li>
              <li>• You only have a dynamic IP</li>
              <li>• Router doesn't support port forwarding</li>
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
              { icon: Router, label: 'Router', sub: 'Port Forwarding', color: 'bg-purple-100 text-purple-600' },
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

        {/* Option 1 — Public IP */}
        <Section title="Option 1 — OLT Has a Public IP" icon={Globe} color="bg-green-500">
          <Note>This is the simplest method. Use it if your ISP gave you a static public IP on the OLT or its uplink.</Note>
          <div className="space-y-6">
            <Step num={1} title="Find your OLT's public IP">
              <p>Check the IP address assigned to the OLT's WAN/uplink interface.</p>
              <p>Or ask your upstream ISP for the static IP assigned to your connection.</p>
            </Step>
            <Step num={2} title="Add OLT in Auto OLT">
              <p>Go to <strong>Add OLT</strong> → select <strong>Connection Type: Direct (Public IP)</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">IP Address:</span><span className="text-blue-600">{'<Your public IP>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Connection Type:</span><span>Direct (Public IP)</span></div>
              </div>
            </Step>
            <Step num={3} title="Run Setup Wizard">
              <p>Click <strong>Start Setup</strong> — the system will connect directly to the OLT via SNMP and Telnet.</p>
              <Note>Make sure UDP port 161 (SNMP) and TCP port 23 (Telnet) are open on the OLT's firewall.</Note>
            </Step>
          </div>
        </Section>

        {/* Option 2 — Port Forwarding */}
        <Section title="Option 2 — OLT Behind Router (Port Forwarding)" icon={Router} color="bg-blue-500">
          <Note type="warn">Your router must have a public/static IP. If your ISP uses CGNAT, port forwarding will not work — use WireGuard VPN instead.</Note>
          <div className="space-y-6 mt-2">
            <Step num={1} title="Check your router has a public IP">
              <p>Log into your router → check the WAN IP address.</p>
              <p>Go to a site like <strong>whatismyip.com</strong> from the router's network and compare — if they match, you have a public IP.</p>
              <Note type="warn">If they don't match, your ISP is using CGNAT and port forwarding won't work.</Note>
            </Step>

            <Step num={2} title="Forward SNMP port (UDP 161) to OLT">
              <p>Log into your router admin panel → find <strong>Port Forwarding / NAT / Virtual Server</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs mt-2">
                <div className="flex justify-between"><span className="text-gray-500">Protocol:</span><span>UDP</span></div>
                <div className="flex justify-between"><span className="text-gray-500">External Port:</span><span>161</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Internal IP:</span><span className="text-blue-600">{'<OLT LAN IP e.g. 192.168.1.1>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Internal Port:</span><span>161</span></div>
              </div>
            </Step>

            <Step num={3} title="Forward Telnet port (TCP 23) to OLT">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Protocol:</span><span>TCP</span></div>
                <div className="flex justify-between"><span className="text-gray-500">External Port:</span><span>23</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Internal IP:</span><span className="text-blue-600">{'<OLT LAN IP e.g. 192.168.1.1>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Internal Port:</span><span>23</span></div>
              </div>
              <Note type="warn">If port 23 is blocked by your ISP, use a different external port (e.g. 2323) and set Telnet Port in the app to 2323.</Note>
            </Step>

            <Step num={4} title="Add OLT in Auto OLT">
              <p>Go to <strong>Add OLT</strong> → select <strong>Connection Type: Direct (Public IP)</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">IP Address:</span><span className="text-blue-600">{'<Router public IP>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Telnet Port:</span><span>23 (or your custom external port)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Connection Type:</span><span>Direct (Public IP)</span></div>
              </div>
            </Step>

            <Step num={5} title="Test SNMP from the server">
              <p>SSH into your Auto OLT server and run:</p>
              <CodeBlock code={`snmpget -v2c -c public <router_public_ip> 1.3.6.1.2.1.1.1.0`} />
              <p>If it returns a value, SNMP is working correctly.</p>
            </Step>
          </div>
        </Section>

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
          </div>
        </Section>

        {/* Option 3 — Dynamic IP + DDNS */}
        <Section title="Option 3 — Dynamic IP with DDNS" icon={Globe} color="bg-yellow-500" defaultOpen={false}>
          <Note type="warn">Dynamic IPs change periodically. Use DDNS to map a hostname to your changing IP.</Note>
          <div className="space-y-6">
            <Step num={1} title="Set up a DDNS service">
              <p>Popular free options: <strong>No-IP</strong>, <strong>DuckDNS</strong>, <strong>Dynu</strong></p>
              <p>Register and get a hostname like <code className="bg-gray-100 px-1 rounded">myolt.duckdns.org</code></p>
            </Step>
            <Step num={2} title="Enable DDNS on your router">
              <p>Most routers have built-in DDNS support under <strong>WAN / Dynamic DNS</strong> settings.</p>
              <p>Enter your DDNS provider credentials — the router will auto-update the hostname when IP changes.</p>
            </Step>
            <Step num={3} title="Add OLT using hostname">
              <p>In Auto OLT → Add OLT → use the DDNS hostname as IP Address:</p>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">IP Address:</span><span className="text-blue-600">myolt.duckdns.org</span></div>
              </div>
              <Note type="warn">Django's <code>GenericIPAddressField</code> only accepts IPs, not hostnames. You may need to resolve the hostname to IP first and update it when it changes.</Note>
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
                  'Verify UDP port 161 is forwarded to the OLT',
                  'Check OLT SNMP is enabled and community string is correct',
                  'Test: snmpget -v2c -c <community> <ip> 1.3.6.1.2.1.1.1.0 from server',
                  'Check OLT firewall is not blocking UDP 161',
                ]
              },
              {
                problem: 'Telnet connection refused',
                solutions: [
                  'Verify TCP port 23 is forwarded to the OLT',
                  'Check Telnet is enabled on the OLT',
                  'Try: telnet <public_ip> 23 from server',
                  'If ISP blocks port 23, use a different external port (e.g. 2323)',
                ]
              },
              {
                problem: 'Port forwarding set up but still cannot connect',
                solutions: [
                  'Your ISP may be using CGNAT — check if WAN IP matches whatismyip.com',
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
    </AppLayout>
  );
}
