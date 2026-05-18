import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auto OLT — Smart ISP Management Platform',
  description: 'Automate your OLT provisioning, ONU registration, VLAN management, and network monitoring. Built for ISPs. Free forever.',
  keywords: ['OLT management', 'ISP automation', 'ONU provisioning', 'SNMP', 'Huawei OLT', 'ZTE OLT', 'VLAN management', 'fiber network'],
  openGraph: {
    title: 'Auto OLT — Smart ISP Management Platform',
    description: 'Automate your OLT provisioning, ONU registration, and network monitoring. Free forever.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
