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
  const [history, setHistory] = useState<{ from: string; to: string } | null>(
    null
  );
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
      setHistory(data.history || null);
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
      <h1>Inbox & Quota</h1>
      <p className="subtitle">
        Full send history (success + failures) · 300/day free tier
      </p>

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

      {history && (
        <p className="muted" style={{ paddingTop: 0, paddingBottom: 8 }}>
          Showing history from <strong>{history.from}</strong> →{' '}
          <strong>{history.to}</strong>
          {messages.length > 0 ? ` · ${messages.length} events` : ''}
        </p>
      )}

      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      {loading && !messages.length && (
        <p className="muted">Loading full history…</p>
      )}

      {!loading && !error && messages.length === 0 && (
        <p className="muted">
          No events found yet. Send an email and hit Refresh.
        </p>
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
        <p>All events from Brevo (sent, delivered, bounces, blocked, etc.)</p>
        <p>Quota bar = today only · List = full project history</p>
      </div>
    </div>
  );
}
