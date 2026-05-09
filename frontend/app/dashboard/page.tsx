'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OLTStatusBadge } from '@/components/ui/Badge';
import { oltApi } from '@/lib/api';
import { OLT } from '@/lib/types';
import { Server, Wifi, AlertCircle, CheckCircle, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [olts, setOlts] = useState<OLT[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const fetchOlts = async () => {
    setFetching(true);
    try {
      const res = await oltApi.list();
      setOlts(res.data.results || (res.data as any));
    } catch (e) {
      toast.error('Failed to load OLTs');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { if (isAuthenticated) fetchOlts(); }, [isAuthenticated]);

  if (isLoading) return null;

  const activeOlts = olts.filter(o => o.status === 'active').length;
  const errorOlts = olts.filter(o => o.status === 'error').length;
  const totalOnus = olts.reduce((s, o) => s + o.onu_count, 0);
  const registeredOnus = olts.reduce((s, o) => s + o.registered_onu_count, 0);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">OLT network overview</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchOlts} loading={fetching}>
              Refresh
            </Button>
            <Link href="/olts/add">
              <Button icon={<Plus className="h-4 w-4" />}>Add OLT</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total OLTs"
            value={olts.length}
            icon={<Server className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            label="Active OLTs"
            value={activeOlts}
            icon={<CheckCircle className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Total ONUs"
            value={totalOnus}
            icon={<Wifi className="h-5 w-5" />}
            color="blue"
            subtitle={`${registeredOnus} registered`}
          />
          <StatCard
            label="Issues"
            value={errorOlts}
            icon={<AlertCircle className="h-5 w-5" />}
            color={errorOlts > 0 ? 'red' : 'gray'}
          />
        </div>

        {/* OLT List */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Your OLT Devices</h2>
            <span className="text-sm text-gray-500">{olts.length} device{olts.length !== 1 ? 's' : ''}</span>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : olts.length === 0 ? (
            <div className="text-center py-16">
              <Server className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No OLT devices yet</p>
              <p className="text-gray-400 text-sm mb-4">Add your first OLT to get started</p>
              <Link href="/olts/add">
                <Button icon={<Plus className="h-4 w-4" />}>Add OLT</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {olts.map(olt => (
                <div key={olt.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        olt.status === 'active' ? 'bg-green-500' :
                        olt.status === 'error' ? 'bg-red-500' :
                        olt.status === 'configuring' ? 'bg-blue-500 animate-pulse' :
                        'bg-gray-400'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{olt.name}</p>
                        <p className="text-sm text-gray-500">{olt.ip_address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
                        <span>{olt.snmp_version.toUpperCase()}</span>
                        <span>{olt.onu_count} ONUs</span>
                        <span>{olt.registered_onu_count} registered</span>
                      </div>
                      <OLTStatusBadge status={olt.status} />
                      <Link href={`/olts/${olt.id}`}>
                        <Button variant="outline" size="sm">Manage</Button>
                      </Link>
                    </div>
                  </div>
                  {olt.system_name && (
                    <p className="text-xs text-gray-400 mt-1 ml-6">
                      {olt.system_name} {olt.system_uptime ? `• Uptime: ${olt.system_uptime}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
