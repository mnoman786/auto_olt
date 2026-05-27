'use client';
import Link from 'next/link';
import { ShieldCheck, Globe, BookOpen, ChevronRight } from 'lucide-react';

const docs = [
  {
    href: '/docs/wireguard',
    icon: ShieldCheck,
    tone: 'from-indigo-50 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 text-indigo-600 dark:text-indigo-400',
    title: 'WireGuard VPN Setup',
    description: 'Connect your OLT behind NAT using WireGuard VPN with MikroTik router. Includes step-by-step MikroTik configuration, peer setup, and troubleshooting.',
    tags: ['VPN', 'MikroTik', 'WireGuard'],
  },
  {
    href: '/docs/port-forwarding',
    icon: Globe,
    tone: 'from-blue-50 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-600 dark:text-blue-400',
    title: 'Public IP / Port Forwarding',
    description: 'Connect your OLT directly using a public IP address or port forwarding on your router. Best for OLTs with direct internet access.',
    tags: ['Direct', 'Port Forwarding', 'Public IP'],
  },
];

export default function DocsIndexPage() {
  return (
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-blue-50/70 dark:from-blue-950/20 via-indigo-50/40 dark:via-transparent to-transparent pointer-events-none" />
        <div className="relative p-4 sm:p-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">Knowledge Base</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Documentation</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Guides for connecting your OLT devices to Auto OLT.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {docs.map((doc) => (
              <Link key={doc.href} href={doc.href} className="group">
                <div className="h-full border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-800 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-700">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl shrink-0 bg-linear-to-br ${doc.tone}`}>
                      <doc.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {doc.title}
                        </h2>
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{doc.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {doc.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
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
  );
}
