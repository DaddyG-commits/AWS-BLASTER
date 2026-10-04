'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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

function norm(s: string) {
  return (s || '').toLowerCase().trim();
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
      // Always load full list for accurate client counts, then apply filter in UI
      const params = new URLSearchParams();
      params.set('limit', '2000');
      if (type !== 'all') params.set('type', type);
      if (q.trim()) params.set('q', q.trim());

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
  }, [type, q]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  // Counts from API, with client recount if delivered/opened stuck at 0
  const display = useMemo(() => {
    const fromRows = {
      total: emails.length,
      sent: emails.filter((e) =>
        ['sent', 'delivered', 'opened'].includes(norm(e.status))
      ).length,
      failed: emails.filter((e) => norm(e.status) === 'failed').length,
      delivered: emails.filter((e) =>
        ['delivered', 'opened'].includes(norm(e.status)) || !!e.delivered_at
      ).length,
      opened: emails.filter(
        (e) => norm(e.status) === 'opened' || !!e.opened_at || (e.open_count || 0) > 0
      ).length,
      otp: emails.filter((e) => norm(e.message_type) === 'otp').length,
      email: emails.filter((e) => norm(e.message_type) === 'email').length,
      today: emails.filter((e) => {
        try {
          return new Date(e.created_at).toDateString() === new Date().toDateString();
        } catch {
          return false;
        }
      }).length,
    };

    if (!stats) return fromRows;

    const apiDelivered = stats.delivered ?? 0;
    const apiOpened = stats.opened ?? 0;

    // Prefer API total when higher; never show 0 for delivered/opened if rows prove otherwise
    return {
      total: Math.max(stats.total || 0, fromRows.total),
      sent: Math.max(stats.sent || 0, fromRows.sent),
      failed: Math.max(stats.failed || 0, fromRows.failed),
      delivered: Math.max(apiDelivered, fromRows.delivered),
      opened: Math.max(apiOpened, fromRows.opened),
      otp: Math.max(stats.otp || 0, fromRows.otp),
      email: Math.max(stats.email || 0, fromRows.email),
      today: Math.max(stats.today || 0, fromRows.today),
    };
  }, [stats, emails]);

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      const s = norm(e.status);
      if (status === 'failed' && s !== 'failed') return false;
      if (status === 'opened' && s !== 'opened' && !e.opened_at) return false;
      if (
        status === 'delivered' &&
        s !== 'delivered' &&
        s !== 'opened' &&
        !e.delivered_at
      )
        return false;
      if (
        status === 'sent' &&
        !['sent', 'delivered', 'opened'].includes(s)
      )
        return false;
      return true;
    });
  }, [emails, status]);

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
          <div className="stat-value">{display.delivered}</div>
          <div className="stat-label">Delivered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{display.opened}</div>
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
        Opens track when the recipient loads images. Counts update from the list and the
        database.
      </p>

      {loading && emails.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No emails for this filter.</p>
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
              {filtered.map((e) => {
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
