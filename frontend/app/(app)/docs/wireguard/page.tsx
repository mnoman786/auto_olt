'use client';
import { Card } from '@/components/ui/Card';
import { useState } from 'react';
import {
  ShieldCheck, Monitor, Router, Server, CheckCircle2,
  Copy, Check, ChevronDown, ChevronUp, AlertTriangle, Wifi
} from 'lucide-react';
import { clsx } from 'clsx';

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-2">
      {label && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>}
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
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-left">{title}</h2>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">{children}</div>}
    </Card>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
        {num}
      </div>
      <div className="flex-1 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
        <p className="font-medium text-gray-900 dark:text-white mb-2">{title}</p>
        <div className="text-gray-600 dark:text-gray-400 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Note({ type = 'info', children }: { type?: 'info' | 'warn'; children: React.ReactNode }) {
  return (
    <div className={clsx(
      'flex items-start gap-2 p-3 rounded-lg text-sm',
      type === 'warn' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
    )}>
      {type === 'warn'
        ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{children}</span>
    </div>
  );
}

export default function WireGuardDocsPage() {
  return (
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-indigo-50/70 dark:from-indigo-950/20 via-blue-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80">Guide</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">WireGuard VPN Setup</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Step-by-step guide to connect your OLT via WireGuard VPN using MikroTik.
            </p>
          </div>
        </div>

        {/* Architecture overview */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">How it works</p>
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            {[
              { icon: Wifi, label: 'Auto OLT App', sub: 'sends to 10.100.0.5', color: 'bg-green-100 text-green-600' },
              { label: '→', color: '' },
              { icon: Server, label: 'Server (wg0)', sub: '10.100.0.1', color: 'bg-blue-100 text-blue-600' },
              { label: '→ Tunnel →', color: '' },
              { icon: Router, label: 'MikroTik', sub: 'wg-autoolt = 10.100.0.5', color: 'bg-purple-100 text-purple-600' },
              { label: '→ DNAT →', color: '' },
              { icon: Monitor, label: 'OLT Device', sub: '192.168.1.1', color: 'bg-orange-100 text-orange-600' },
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Each customer gets a unique virtual IP from the 10.100.0.0/16 pool so multiple customers
            with the same default LAN (e.g. 192.168.1.0/24) do not collide. MikroTik&apos;s DNAT rule
            rewrites the virtual IP to the OLT&apos;s real LAN IP.
          </p>
        </div>

        {/* Section 1 - Before you start */}
        <Section title="Before You Start" icon={CheckCircle2} color="bg-green-500">
          <div className="space-y-2">
            {[
              'MikroTik router with RouterOS 7.1 or newer (WireGuard support required)',
              'MikroTik must have internet access to reach the Auto OLT server',
              'OLT device must be on the same LAN as MikroTik',
              'You need the Server Public Key and Endpoint from the Setup Wizard',
              'You need to know your customer LAN subnet (e.g. 192.168.1.0/24)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Section 2 - MikroTik Setup */}
        <Section title="Step-by-Step: MikroTik WireGuard Setup" icon={Router} color="bg-purple-500">
          <div className="space-y-6">
            <Step num={1} title="Add WireGuard Interface">
              <p>Go to <strong>WireGuard &rarr; + (Add)</strong></p>
              <p>Give it a name like <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">wg-autoolt</code></p>
              <p>MikroTik will auto-generate a private/public key pair.</p>
              <p>Click <strong>OK</strong> to save.</p>
              <Note>Copy the <strong>Public Key</strong> shown &mdash; you will paste this in the Auto OLT Setup Wizard.</Note>
            </Step>

            <Step num={2} title="Add Peer (Auto OLT Server)">
              <p>Go to <strong>WireGuard &rarr; Peers &rarr; + (Add)</strong></p>
              <div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Interface:</span><span>wg-autoolt</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Public Key:</span><span className="text-blue-600">{'<Server Public Key from app>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Endpoint:</span><span>162.217.248.75:51820</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Allowed Address:</span><span>10.100.0.0/16</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Persistent Keepalive:</span><span>25</span></div>
              </div>
              <Note>The <strong>Server Public Key</strong> and <strong>Endpoint</strong> are shown in the Setup Wizard under &quot;Give these to customer&quot;.</Note>
            </Step>

            <Step num={3} title="Assign IP Address to WireGuard Interface">
              <p>Go to <strong>IP &rarr; Addresses &rarr; + (Add)</strong></p>
              <div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Address:</span><span className="text-blue-600">{'<Virtual IP from app>/32'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Interface:</span><span>wg-autoolt</span></div>
              </div>
              <Note>The <strong>Virtual IP</strong> (e.g. <code>10.100.0.5/32</code>) is shown in the Setup Wizard under &quot;Assigned Virtual IP&quot;. This is what the server uses to identify your MikroTik.</Note>
            </Step>

            <Step num={4} title="Add DNAT rule — virtual IP → OLT LAN IP (CRITICAL)">
              <Note type="warn">Without this step, the tunnel will connect but SNMP / Telnet to the OLT will fail. The server addresses the OLT via the virtual IP &mdash; MikroTik must rewrite that to the OLT&apos;s real LAN IP.</Note>
              <p className="mt-2">In Winbox: <strong>IP &rarr; Firewall &rarr; NAT &rarr; + (Add)</strong></p>
              <p className="font-medium mt-2">General tab:</p>
              <div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Chain:</span><span>dstnat</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Dst. Address:</span><span className="text-blue-600">{'<Virtual IP from app>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">In. Interface:</span><span>wg-autoolt</span></div>
              </div>
              <p className="font-medium mt-2">Action tab:</p>
              <div className="bg-gray-50 dark:bg-gray-700/60 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Action:</span><span>dst-nat</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">To Addresses:</span><span className="text-blue-600">{'<OLT LAN IP e.g. 192.168.1.1>'}</span></div>
              </div>
              <p className="mt-2 text-sm text-gray-500">Or via CLI:</p>
              <CodeBlock code={`/ip firewall nat add chain=dstnat in-interface=wg-autoolt \\\n  dst-address=<virtual_ip> action=dst-nat \\\n  to-addresses=<olt_lan_ip>`} />
              <Note>You also need a masquerade rule so return traffic from the OLT goes back through the tunnel:</Note>
              <CodeBlock code={`/ip firewall nat add chain=srcnat out-interface=<LAN_interface> \\\n  src-address=<virtual_ip> action=masquerade`} />
            </Step>

            <Step num={5} title="Verify Connection">
              <p>From MikroTik terminal, check the tunnel is up by pinging the server&apos;s WireGuard interface IP (it&apos;s the lowest IP in the pool, usually <code>10.100.0.1</code>):</p>
              <CodeBlock code="/ping 10.100.0.1" />
              <p>Then verify the OLT is reachable from MikroTik LAN-side:</p>
              <CodeBlock code="/ping <OLT LAN IP>" />
              <p>If both reply, go back to Setup Wizard and click <strong>Test Connection</strong>.</p>
            </Step>
          </div>
        </Section>

        {/* Section 3 - App Side */}
        <Section title="App Side: Setup Wizard Steps" icon={Monitor} color="bg-blue-500">
          <div className="space-y-6">
            <Step num={1} title="Add VPN OLT">
              <p>In Auto OLT &rarr; Add OLT &rarr; select <strong>Connection Type: VPN (WireGuard)</strong></p>
              <p>Set IP Address to the OLT&apos;s real LAN IP (e.g. <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">192.168.1.1</code>)</p>
              <p>System auto-assigns a Virtual IP from the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">10.100.0.0/16</code> pool.</p>
            </Step>

            <Step num={2} title="Setup Wizard — Configure Peer">
              <p>Give the customer (MikroTik admin):</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Server Endpoint</li>
                <li>Server Public Key</li>
                <li>Assigned Virtual IP</li>
              </ul>
              <p className="mt-2">Get from customer:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>MikroTik WireGuard Public Key</li>
                <li>Customer LAN Subnet (e.g. 192.168.1.0/24)</li>
              </ul>
              <p className="mt-2">Paste the public key &rarr; click <strong>Save &amp; Configure Peer</strong></p>
              <Note>The app automatically runs <code>wg set wg0 peer ...</code> on the server.</Note>
            </Step>

            <Step num={3} title="Test &amp; Start">
              <p>Click <strong>Test Connection</strong> &mdash; should show green if MikroTik is connected.</p>
              <p>Click <strong>Start Setup</strong> &mdash; SNMP and Telnet will go through the VPN tunnel to reach the OLT.</p>
            </Step>
          </div>
        </Section>

        {/* Section 4 - CLI Reference */}
        <Section title="Server CLI Reference" icon={Server} color="bg-gray-600" defaultOpen={false}>
          <CodeBlock label="Check all connected peers:" code="wg show wg0" />
          <CodeBlock label="Check peer handshakes:" code="wg show wg0 latest-handshakes" />
          <CodeBlock label="Manually add a peer:" code={`wg set wg0 peer <public_key> allowed-ips <virtual_ip>/32,<lan_subnet>\nwg-quick save wg0`} />
          <CodeBlock label="Remove a peer:" code={`wg set wg0 peer <public_key> remove\nwg-quick save wg0`} />
          <CodeBlock label="Restart WireGuard:" code="systemctl restart wg-quick@wg0" />
        </Section>

        {/* Section 5 - Troubleshooting */}
        <Section title="Troubleshooting" icon={AlertTriangle} color="bg-red-500" defaultOpen={false}>
          <div className="space-y-4">
            {[
              {
                problem: 'Test Connection shows "Not connected"',
                solutions: [
                  'Check MikroTik WireGuard peer is configured with correct server public key',
                  'Verify the Endpoint IP and port (162.217.248.75:51820)',
                  'Make sure Persistent Keepalive is set to 25',
                  'Check MikroTik has internet access',
                  'Try pinging 10.99.0.1 from MikroTik terminal',
                ]
              },
              {
                problem: 'Peer added but wg show shows no handshake',
                solutions: [
                  'MikroTik has not initiated a connection yet — set Persistent Keepalive to 25',
                  'Firewall on server may be blocking UDP 51820 — check ufw/iptables',
                  'MikroTik clock may be wrong — sync NTP',
                ]
              },
              {
                problem: 'SNMP/Telnet fails after VPN connected (handshake OK but no data)',
                solutions: [
                  'Most common cause: the MikroTik DNAT rule (Step 4) is missing or wrong',
                  'Verify: from MikroTik terminal, run "/ip firewall nat print" and confirm a dstnat rule rewrites the virtual IP to the OLT LAN IP',
                  'Confirm in. interface is wg-autoolt on the DNAT rule',
                  'Check OLT is reachable from MikroTik: /ping <OLT LAN IP>',
                  'Make sure the masquerade rule (srcnat) exists so OLT replies reach the tunnel',
                  'Test from server: ping <virtual_ip> — should reply via tunnel; then snmpget against the virtual IP',
                ]
              },
            ].map(({ problem, solutions }, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                <p className="font-medium text-red-600 mb-2">&#10060; {problem}</p>
                <ul className="space-y-1">
                  {solutions.map((s, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-green-500 mt-0.5">&rarr;</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
        </div>
      </div>
  );
}
