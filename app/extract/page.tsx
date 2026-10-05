'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** SEC extract removed — redirect to Leads (sent inbox). */
export default function ExtractRemovedPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/leads');
  }, [router]);
  return (
    <div className="container">
      <p className="muted">SEC extract has been removed. Redirecting to Leads…</p>
    </div>
  );
}
