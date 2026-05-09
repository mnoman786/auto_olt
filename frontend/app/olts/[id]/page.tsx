'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OLTStatusBadge } from '@/components/ui/Badge';
import { oltApi } from '@/lib/api';
import type { OLT, OLTStats } from '@/lib/types';
import {
  ArrowLeft, Server, Wifi, Network, Terminal, Settings,
  RefreshCw, Play, Loader2, Pencil, Trash2, CheckCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OLTDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const oltId = parseInt(params.id as string);

  const [olt, setOlt] = useState<OLT | null>(null);
  const [stats, setStats] = useState<OLTStats | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [oltRes, statsRes] = await Promise.all([
        oltApi.get(oltId),
        oltApi.stats(oltId),
      ]);
      setOlt(oltRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load OLT data');
    } finally {
      setFetching(false);
    }
  }, [oltId]);

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, fetchData]);

  const handleDelete = async () => {
    if (!olt) return;
    if (!confirm(`Delete OLT "${olt.name}"? This will remove all associated ONUs and VLANs.`)) return;
    try {
      await oltApi.delete(oltId);
      toast.success(`OLT "${olt.name}" deleted`);
      router.push('/dashboard');
    } catch {
      toast.error('Failed to delete OLT');
    }
  };

  const handlePoll = async () => {
    try {
      await oltApi.poll(oltId);
      toast.success('SNMP poll started...');
      setTimeout(fetchData, 5000);
    } catch {
      toast.error('Poll failed');
    }
  };

  if (isLoading || fetching) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  if (!olt) return null;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Dashboard</Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{olt.name}</h1>
              <OLTStatusBadge status={olt.status} />
            </div>
            <p className="text-gray-500 text-sm">{olt.ip_address}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={handlePoll}>
              Poll
            </Button>
            <Link href={`/olts/${oltId}/setup`}>
              <Button variant="outline" size="sm" icon={<Play className="h-4 w-4" />}>
                Setup
              </Button>
            </Link>
            <Button
              variant="ghost" size="sm"
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
              onClick={handleDelete}
              className="text-red-500 hover:bg-red-50"
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total ONUs" value={stats.total_onus} icon={<Wifi className="h-5 w-5" />} color="blue" />
            <StatCard label="Active ONUs" value={stats.active_onus} icon={<CheckCircle className="h-5 w-5" />} color="green" />
            <StatCard label="Unregistered" value={stats.unregistered_onus} icon={<AlertCircle className="h-5 w-5" />} color={stats.unregistered_onus > 0 ? 'yellow' : 'gray'} />
            <StatCard label="Offline" value={stats.offline_onus} icon={<AlertCircle className="h-5 w-5" />} color={stats.offline_onus > 0 ? 'red' : 'gray'} />
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { href: `/olts/${oltId}/onus`, label: 'ONU Management', icon: Wifi, desc: 'View and provision ONUs' },
            { href: `/olts/${oltId}/vlans`, label: 'VLAN Management', icon: Network, desc: 'Configure VLANs' },
            { href: `/olts/${oltId}/setup`, label: 'Setup Wizard', icon: Settings, desc: 'Configure OLT' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:border-blue-300 hover:shadow transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <item.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* OLT Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" />
              OLT Configuration
            </h2>
            <div className="space-y-3 text-sm">
              {[
                ['IP Address', olt.ip_address],
                ['SNMP Version', olt.snmp_version.toUpperCase()],
                ['SNMP Read Community', olt.snmp_read_community],
                ['SNMP Write Community', olt.snmp_write_community || 'Not set'],
                ['Telnet', olt.telnet_enabled ? `Enabled (port ${olt.telnet_port})` : 'Disabled'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Network className="h-4 w-4 text-green-600" />
              System Information
            </h2>
            <div className="space-y-3 text-sm">
              {[
                ['System Name', olt.system_name || 'N/A'],
                ['Uptime', olt.system_uptime || 'N/A'],
                ['Status', olt.status],
                ['Last Polled', olt.last_polled ? new Date(olt.last_polled).toLocaleString() : 'Never'],
                ['Added', new Date(olt.created_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800 text-right max-w-xs truncate">{v}</span>
                </div>
              ))}
            </div>
            {olt.system_description && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 font-medium mb-1">System Description</p>
                <p className="text-xs text-gray-600 break-all">{olt.system_description}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
