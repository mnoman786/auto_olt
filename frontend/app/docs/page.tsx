'use client';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import { ShieldCheck, Globe, BookOpen, ChevronRight } from 'lucide-react';

const docs = [
  {
    href: '/docs/wireguard',
    icon: ShieldCheck,
    tone: 'from-indigo-50 to-blue-100 text-indigo-600',
    title: 'WireGuard VPN Setup',
    description: 'Connect your OLT behind NAT using WireGuard VPN with MikroTik router. Includes step-by-step MikroTik configuration, peer setup, and troubleshooting.',
    tags: ['VPN', 'MikroTik', 'WireGuard'],
  },
  {
    href: '/docs/port-forwarding',
    icon: Globe,
    tone: 'from-blue-50 to-cyan-100 text-blue-600',
    title: 'Public IP / Port Forwarding',
    description: 'Connect your OLT directly using a public IP address or port forwarding on your router. Best for OLTs with direct internet access.',
    tags: ['Direct', 'Port Forwarding', 'Public IP'],
  },
];

export default function DocsIndexPage() {
  return (
    <AppLayout>
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 via-indigo-50/40 to-transparent pointer-events-none" />
        <div className="relative p-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">Knowledge Base</p>
              <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Documentation</h1>
              <p className="text-gray-500 text-sm">
                Guides for connecting your OLT devices to Auto OLT.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {docs.map((doc) => (
              <Link key={doc.href} href={doc.href} className="group">
                <div className="h-full border border-gray-200 rounded-xl p-5 bg-white cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 bg-linear-to-br ${doc.tone}`}>
                      <doc.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {doc.title}
                        </h2>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{doc.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {doc.tags.map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-600 rounded-full font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
