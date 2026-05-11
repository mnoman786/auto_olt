'use client';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import { ShieldCheck, Globe, BookOpen, ChevronRight } from 'lucide-react';

const docs = [
  {
    href: '/docs/wireguard',
    icon: ShieldCheck,
    color: 'bg-indigo-500',
    bg: 'bg-indigo-50',
    border: 'hover:border-indigo-300',
    title: 'WireGuard VPN Setup',
    description: 'Connect your OLT behind NAT using WireGuard VPN with MikroTik router. Includes step-by-step MikroTik configuration, peer setup, and troubleshooting.',
    tags: ['VPN', 'MikroTik', 'WireGuard'],
  },
  {
    href: '/docs/port-forwarding',
    icon: Globe,
    color: 'bg-blue-500',
    bg: 'bg-blue-50',
    border: 'hover:border-blue-300',
    title: 'Public IP / Port Forwarding',
    description: 'Connect your OLT directly using a public IP address or port forwarding on your router. Best for OLTs with direct internet access.',
    tags: ['Direct', 'Port Forwarding', 'Public IP'],
  },
];

export default function DocsIndexPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-800 rounded-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
          </div>
          <p className="text-gray-500 ml-14">
            Guides for connecting your OLT devices to Auto OLT management system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {docs.map((doc) => (
            <Link key={doc.href} href={doc.href}>
              <div className={`border border-gray-200 rounded-xl p-5 bg-white cursor-pointer transition-all hover:shadow-md ${doc.border} group`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${doc.bg}`}>
                    <doc.icon className={`h-6 w-6 ${doc.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {doc.title}
                      </h2>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 shrink-0" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{doc.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {doc.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
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
    </AppLayout>
  );
}
