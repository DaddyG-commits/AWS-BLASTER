'use client';

import { useCallback, useEffect, useState } from 'react';

type Quota = {
  limit: number;
  used: number | null;
  remaining: number | null;
  percent: number | null;
  date: string;
  note?: string;
};

export default function InboxPage() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load');
      }
      setQuota(data.quota);
      setAccount(data.account || null);
      setConfigured(Boolean(data.configured));
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container wide">
      <h1>Inbox &amp; Quota</h1>
      <p className="subtitle">Gmail SMTP · check Sent folder for history</p>

      <div className="quota-card">
        <div className="quota-row">
          <span>Provider</span>
          <strong>Gmail</strong>
        </div>
        <div className="quota-row">
          <span>Account</span>
          <strong style={{ fontSize: '0.85rem' }}>
            {configured ? account || 'configured' : 'Not configured'}
          </strong>
        </div>
        <div className="quota-row">
          <span>Typical daily limit</span>
          <strong>~{quota?.limit ?? 500}</strong>
        </div>
        <div className="quota-row" style={{ marginBottom: 0 }}>
          <span>Today</span>
          <strong>{quota?.date || '—'}</strong>
        </div>
      </div>

      {!configured && (
        <div className="message error">
          Set SMTP_USER and SMTP_PASS (App Password) on Vercel, then redeploy.
        </div>
      )}

      {configured && (
        <div className="message info">
          Gmail does not provide a public “sent count” API. Open{' '}
          <strong>Gmail → Sent</strong> for{' '}
          <strong>{account}</strong> to see every message and failures.
          {quota?.note ? (
            <div style={{ marginTop: 8, fontSize: '0.85rem' }}>{quota.note}</div>
          ) : null}
        </div>
      )}

      <div className="row-actions" style={{ marginTop: 16 }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="api-info">
        <p>Sending uses Gmail SMTP (App Password)</p>
        <p>Free Gmail is often limited to about 500 emails per day</p>
      </div>
    </div>
  );
}
