'use client';

import { useCallback, useEffect, useState } from 'react';

type Email = {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  message_type: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
  created_at: string;
  delivered_at?: string | null;
  opened_at?: string | null;
  open_count?: number | null;
};

type Stats = {
  total: number;
  sent: number;
  failed: number;
  delivered?: number;
  opened?: number;
  otp: number;
  email: number;
  today: number;
  todaySent: number;
  todayFailed: number;
  database?: boolean;
  error?: string;
};

function statusBadge(e: Email) {
  const s = (e.status || '').toLowerCase();
  if (s === 'failed') return { label: 'failed', className: 'error' };
  if (s === 'opened' || e.opened_at) return { label: 'opened', className: 'open' };
  if (s === 'delivered' || e.delivered_at) return { label: 'delivered', className: 'delivered' };
  if (s === 'sent') return { label: 'sent', className: 'sent' };
  return { label: s || 'unknown', className: 'sent' };
}

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'sent' | 'delivered' | 'opened' | 'failed'>('all');
  const [type, setType] = useState<'all' | 'email' | 'otp'>('all');
  const [q, setQ] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '2000');

      const [emailsRes, statsRes] = await Promise.all([
        fetch(`/api/emails?${params}`),
        fetch('/api/stats'),
      ]);
      const emailsData = await emailsRes.json();
      const statsData = await statsRes.json();

      setEmails(emailsData.emails || []);
      setWarning(emailsData.warning || emailsData.error || statsData.error || '');
      setStats(statsData);
    } catch {
      setWarning('Could not load inbox');
    } finally {
      setLoading(false);
    }
  }, [status, type, q]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const display = stats || {
    total: 0,
    sent: 0,
    failed: 0,
    delivered: 0,
    opened: 0,
    otp: 0,
    email: 0,
    today: 0,
  };

  return (
    <div className="container wide">
      <h1>Sent inbox</h1>
      <p className="subtitle">
        Sent → Delivered → Opened · auto-refresh every 20s
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{display.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card ok">
          <div className="stat-value">{display.sent}</div>
          <div className="stat-label">Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{display.delivered ?? 0}</div>
          <div className="stat-label">Delivered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{display.opened ?? 0}</div>
          <div className="stat-label">Opened</div>
        </div>
        <div className="stat-card bad">
          <div className="stat-value">{display.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{display.today}</div>
          <div className="stat-label">Today</div>
        </div>
      </div>

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All status</option>
          <option value="sent">Sent / pipeline</option>
          <option value="delivered">Delivered</option>
          <option value="opened">Opened</option>
          <option value="failed">Failed</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="all">All types</option>
          <option value="email">Email</option>
          <option value="otp">OTP</option>
        </select>
        <input
          type="search"
          placeholder="Search recipient or subject"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="secondary"
          onClick={load}
          style={{ width: 'auto', padding: '10px 16px' }}
        >
          Refresh
        </button>
      </div>

      {warning && <div className="message info">{warning}</div>}

      <p className="muted" style={{ textAlign: 'left', padding: '0 0 12px' }}>
        Opens are tracked when the recipient loads images (HTML emails). Some clients
        block images until the user allows them.
      </p>

      {loading && emails.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : emails.length === 0 ? (
        <p className="muted">No emails logged yet. Send one from the Send Email page.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Opens</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => {
                const b = statusBadge(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <span className={`badge ${b.className}`}>{b.label}</span>
                    </td>
                    <td>{e.message_type}</td>
                    <td>{e.recipient}</td>
                    <td>{e.subject}</td>
                    <td>
                      {e.open_count && e.open_count > 0
                        ? `${e.open_count}${e.opened_at ? ` · ${new Date(e.opened_at).toLocaleString()}` : ''}`
                        : '—'}
                    </td>
                    <td>{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
