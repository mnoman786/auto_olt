'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CapacityRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/olts/${params.id}/ports`);
  }, [params.id, router]);
  return null;
}
