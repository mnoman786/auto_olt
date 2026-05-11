'use client';
import AppLayout from '@/components/layout/AppLayout';
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
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
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

export default function WireGuardDocsPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">WireGuard VPN Setup Guide</h1>
          </div>
          <p className="text-gray-500 ml-14">
            Step-by-step guide to connect your OLT to Auto OLT via WireGuard VPN using MikroTik router.
          </p>
        </div>

        {/* Architecture overview */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How it works</p>
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            {[
              { icon: Monitor, label: 'OLT Device', sub: '192.168.1.1', color: 'bg-orange-100 text-orange-600' },
              { label: '→', color: '' },
              { icon: Router, label: 'MikroTik', sub: 'WireGuard Client', color: 'bg-purple-100 text-purple-600' },
              { label: '→ Tunnel →', color: '' },
              { icon: Server, label: 'Auto OLT Server', sub: '162.217.248.75', color: 'bg-blue-100 text-blue-600' },
              { label: '→', color: '' },
              { icon: Wifi, label: 'App', sub: 'via Virtual IP', color: 'bg-green-100 text-green-600' },
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

        {/* Section 1 — Before you start */}
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

        {/* Section 2 — MikroTik Setup */}
        <Section title="Step-by-Step: MikroTik WireGuard Setup" icon={Router} color="bg-purple-500">
          <div className="space-y-6">
            <Step num={1} title="Add WireGuard Interface">
              <p>Go to <strong>WireGuard → + (Add)</strong></p>
              <p>Give it a name like <code className="bg-gray-100 px-1 rounded">wg-autoolt</code></p>
              <p>MikroTik will auto-generate a private/public key pair.</p>
              <p>Click <strong>OK</strong> to save.</p>
              <Note>Copy the <strong>Public Key</strong> shown — you will paste this in the Auto OLT Setup Wizard.</Note>
            </Step>

            <Step num={2} title="Add Peer (Auto OLT Server)">
              <p>Go to <strong>WireGuard → Peers → + (Add)</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Interface:</span><span>wg-autoolt</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Public Key:</span><span className="text-blue-600">{'<Server Public Key from app>'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Endpoint:</span><span>162.217.248.75:51820</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Allowed Address:</span><span>10.100.0.0/16</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Persistent Keepalive:</span><span>25</span></div>
              </div>
              <Note>The <strong>Server Public Key</strong> and <strong>Endpoint</strong> are shown in the Setup Wizard under "Give these to customer".</Note>
            </Step>

            <Step num={3} title="Assign IP Address to WireGuard Interface">
              <p>Go to <strong>IP → Addresses → + (Add)</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Address:</span><span className="text-blue-600">{'<Virtual IP from app>/32'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Interface:</span><span>wg-autoolt</span></div>
              </div>
              <Note>The <strong>Virtual IP</strong> (e.g. <code>10.100.0.5/32</code>) is shown in the Setup Wizard under "Assigned Virtual IP".</Note>
            </Step>

            <Step num={4} title="Add Route (so server can reach OLT)">
              <p>Go to <strong>IP → Routes → + (Add)</strong></p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 font-mono text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Dst. Address:</span><span>10.99.0.0/24</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Gateway:</span><span>wg-autoolt</span></div>
              </div>
              <p>This allows return traffic from the server to flow back through the tunnel.</p>
            </Step>

            <Step num={5} title="Verify Connection">
              <p>From MikroTik terminal, ping the server tunnel IP:</p>
              <CodeBlock code="/ping 10.99.0.1" />
              <p>If it replies, the tunnel is up. Go back to Setup Wizard and click <strong>Test Connection</strong>.</p>
            </Step>
          </div>
        </Section>

        {/* Section 3 — App Side */}
        <Section title="App Side: Setup Wizard Steps" icon={Monitor} color="bg-blue-500">
          <div className="space-y-6">
            <Step num={1} title="Add VPN OLT">
              <p>In Auto OLT → Add OLT → select <strong>Connection Type: VPN (WireGuard)</strong></p>
              <p>Set IP Address to the OLT's real LAN IP (e.g. <code className="bg-gray-100 px-1 rounded">192.168.1.1</code>)</p>
              <p>System auto-assigns a Virtual IP from the <code className="bg-gray-100 px-1 rounded">10.100.0.0/16</code> pool.</p>
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
              <p className="mt-2">Paste the public key → click <strong>Save & Configure Peer</strong></p>
              <Note>The app automatically runs <code>wg set wg0 peer ...</code> on the server.</Note>
            </Step>

            <Step num={3} title="Test & Start">
              <p>Click <strong>Test Connection</strong> — should show green if MikroTik is connected.</p>
              <p>Click <strong>Start Setup</strong> — SNMP and Telnet will go through the VPN tunnel to reach the OLT.</p>
            </Step>
          </div>
        </Section>

        {/* Section 4 — CLI Reference */}
        <Section title="Server CLI Reference" icon={Server} color="bg-gray-600" defaultOpen={false}>
          <CodeBlock label="Check all connected peers:" code="wg show wg0" />
          <CodeBlock label="Check peer handshakes:" code="wg show wg0 latest-handshakes" />
          <CodeBlock label="Manually add a peer:" code={`wg set wg0 peer <public_key> allowed-ips <virtual_ip>/32,<lan_subnet>\nwg-quick save wg0`} />
          <CodeBlock label="Remove a peer:" code={`wg set wg0 peer <public_key> remove\nwg-quick save wg0`} />
          <CodeBlock label="Restart WireGuard:" code="systemctl restart wg-quick@wg0" />
        </Section>

        {/* Section 5 — Troubleshooting */}
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
                problem: 'SNMP/Telnet fails after VPN connected',
                solutions: [
                  'Check the OLT IP is correct (real LAN IP, not virtual IP)',
                  'Verify MikroTik has a route for the server subnet',
                  'Check OLT is reachable from MikroTik: ping OLT IP from MikroTik terminal',
                  'Make sure Customer LAN Subnet is correctly entered in the app',
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
      </div>
    </AppLayout>
  );
}
