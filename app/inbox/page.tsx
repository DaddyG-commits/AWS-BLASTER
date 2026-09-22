'use client';

import { useCallback, useEffect, useState } from 'react';

type Quota = {
  limit: number;
  used: number;
  remaining: number;
  percent: number;
  date: string;
};

type Msg = {
  email: string;
  subject: string;
  event: string;
  date: string | null;
  messageId: string | null;
  reason: string | null;
};

export default function InboxPage() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load inbox');
      }
      setQuota(data.quota);
      setMessages(data.messages || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fillClass =
    !quota
      ? ''
      : quota.percent >= 90
        ? 'danger'
        : quota.percent >= 70
          ? 'warn'
          : '';

  return (
    <div className="container wide">
      <h1>Inbox &amp; Quota</h1>
      <p className="subtitle">Sent activity from Brevo · 300/day free tier</p>

      {quota && (
        <div className="quota-card">
          <div className="quota-row">
            <span>Today ({quota.date})</span>
            <strong>
              {quota.used} / {quota.limit}
            </strong>
          </div>
          <div className="quota-bar">
            <div
              className={`quota-fill ${fillClass}`}
              style={{ width: `${quota.percent}%` }}
            />
          </div>
          <div className="quota-row" style={{ marginTop: 10, marginBottom: 0 }}>
            <span className="muted" style={{ padding: 0 }}>
              {quota.remaining} remaining today
            </span>
            <span>{quota.percent}%</span>
          </div>
        </div>
      )}

      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      {loading && !messages.length && (
        <p className="muted">Loading sent messages…</p>
      )}

      {!loading && !error && messages.length === 0 && (
        <p className="muted">No events found for today yet. Send an email first.</p>
      )}

      <div className="list">
        {messages.map((m, i) => (
          <div key={`${m.messageId || m.email}-${i}`} className="list-item">
            <div>
              <strong>{m.email}</strong>
              <span className={`badge ${m.event}`}>{m.event}</span>
            </div>
            <div>{m.subject}</div>
            <div className="list-meta">
              {m.date ? new Date(m.date).toLocaleString() : '—'}
              {m.reason ? ` · ${m.reason}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="api-info">
        <p>Data from Brevo transactional statistics</p>
        <p>Free plan limit is typically 300 emails / day</p>
      </div>
    </div>
  );
}
