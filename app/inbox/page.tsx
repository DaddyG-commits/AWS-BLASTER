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
};

type Stats = {
  total: number;
  sent: number;
  failed: number;
  otp: number;
  email: number;
  today: number;
  todaySent: number;
  todayFailed: number;
  database?: boolean;
  error?: string;
};

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'all' | 'sent' | 'failed'>('all');
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
      params.set('limit', '500');

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
  }, [load]);

  // Fallback: if API stats are zero but we have rows, count from loaded list
  const displayStats = useMemo(() => {
    const list = emails;
    const fromList = {
      total: list.length,
      sent: list.filter((e) => e.status?.toLowerCase() === 'sent').length,
      failed: list.filter((e) => e.status?.toLowerCase() === 'failed').length,
      otp: list.filter((e) => e.message_type?.toLowerCase() === 'otp').length,
      email: list.filter((e) => e.message_type?.toLowerCase() === 'email').length,
      today: list.filter((e) => {
        const d = new Date(e.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      }).length,
    };

    if (!stats) return fromList;

    // Prefer API when it has real totals; otherwise use list counts for visible cards
    if ((stats.total || 0) > 0) {
      return {
        total: stats.total,
        sent: stats.sent,
        failed: stats.failed,
        otp: stats.otp,
        email: stats.email,
        today: stats.today,
      };
    }

    return fromList;
  }, [stats, emails]);

  return (
    <div className="container wide">
      <h1>Sent inbox</h1>
      <p className="subtitle">Every send and failure logged with counts</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{displayStats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card ok">
          <div className="stat-value">{displayStats.sent}</div>
          <div className="stat-label">Sent</div>
        </div>
        <div className="stat-card bad">
          <div className="stat-value">{displayStats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{displayStats.today}</div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{displayStats.otp}</div>
          <div className="stat-label">OTP</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{displayStats.email}</div>
          <div className="stat-label">Email</div>
        </div>
      </div>

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All status</option>
          <option value="sent">Sent only</option>
          <option value="failed">Failed only</option>
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

      {loading ? (
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
                <th>Error</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span
                      className={`badge ${
                        e.status?.toLowerCase() === 'sent' ? 'sent' : 'error'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td>{e.message_type}</td>
                  <td>{e.recipient}</td>
                  <td>{e.subject}</td>
                  <td className="err-cell">{e.error_message || '—'}</td>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
