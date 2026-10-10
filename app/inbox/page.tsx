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
  clicked_at?: string | null;
  click_count?: number | null;
  last_event?: string | null;
};

type Stats = {
  total: number;
  sent: number;
  failed: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
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
  const ev = (e.last_event || '').toLowerCase();
  if (s === 'failed') return { label: 'failed', className: 'error' };
  if (ev === 'clicked' || (e.click_count && e.click_count > 0))
    return { label: 'clicked', className: 'open' };
  if (s === 'opened' || e.opened_at) return { label: 'opened', className: 'open' };
  if (s === 'delivered' || e.delivered_at) return { label: 'delivered', className: 'delivered' };
  if (s === 'sent') return { label: 'sent', className: 'sent' };
  return { label: s || 'unknown', className: 'sent' };
}

function norm(s: string) {
  return (s || '').toLowerCase().trim();
}

function uniqueEmails(emails: Email[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const em = (e.recipient || '').trim().toLowerCase();
    if (!em || seen.has(em)) continue;
    seen.add(em);
    out.push(e.recipient.trim());
  }
  return out;
}

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    'all' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'
  >('all');
  const [type, setType] = useState<'all' | 'email' | 'otp'>('all');
  const [q, setQ] = useState('');
  const [warning, setWarning] = useState('');
  const [copyFormat, setCopyFormat] = useState<'newline' | 'comma' | 'semicolon'>('newline');
  const [copyMsg, setCopyMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
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
      clicked: emails.filter(
        (e) =>
          norm(e.last_event || '') === 'clicked' || (e.click_count || 0) > 0
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

    return {
      total: Math.max(stats.total || 0, fromRows.total),
      sent: Math.max(stats.sent || 0, fromRows.sent),
      failed: Math.max(stats.failed || 0, fromRows.failed),
      delivered: Math.max(stats.delivered ?? 0, fromRows.delivered),
      opened: Math.max(stats.opened ?? 0, fromRows.opened),
      clicked: Math.max(stats.clicked ?? 0, fromRows.clicked),
      otp: Math.max(stats.otp || 0, fromRows.otp),
      email: Math.max(stats.email || 0, fromRows.email),
      today: Math.max(stats.today || 0, fromRows.today),
    };
  }, [stats, emails]);

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      const s = norm(e.status);
      const clicked =
        norm(e.last_event || '') === 'clicked' || (e.click_count || 0) > 0;
      if (status === 'failed' && s !== 'failed') return false;
      if (status === 'clicked' && !clicked) return false;
      if (status === 'opened' && s !== 'opened' && !e.opened_at && !clicked)
        return false;
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

  const emailCount = useMemo(() => uniqueEmails(filtered).length, [filtered]);

  const filterLabel =
    status === 'opened'
      ? 'Opened'
      : status === 'clicked'
        ? 'Clicked'
        : status === 'failed'
          ? 'Failed'
          : status === 'delivered'
            ? 'Delivered'
            : status === 'sent'
              ? 'Sent'
              : 'All';

  const copyEmails = async () => {
    const list = uniqueEmails(filtered);
    if (list.length === 0) {
      setCopyMsg('No emails to copy');
      setTimeout(() => setCopyMsg(''), 2000);
      return;
    }
    const sep =
      copyFormat === 'comma' ? ', ' : copyFormat === 'semicolon' ? '; ' : '\n';
    const text = list.join(sep);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`Copied ${list.length} email${list.length === 1 ? '' : 's'}`);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopyMsg(`Copied ${list.length} email${list.length === 1 ? '' : 's'}`);
      } catch {
        setCopyMsg('Copy failed');
      }
    }
    setTimeout(() => setCopyMsg(''), 2500);
  };

  return (
    <div className="container wide">
      <h1>Sent inbox</h1>
      <p className="subtitle">
        Sent → Delivered → Opened → Clicked · auto-refresh every 20s
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
        <div className="stat-card">
          <div className="stat-value">{display.clicked}</div>
          <div className="stat-label">Clicked</div>
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
          <option value="clicked">Clicked</option>
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

      <div className="filter-bar" style={{ alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Copy from filter ({filterLabel})
        </span>
        <select
          value={copyFormat}
          onChange={(e) =>
            setCopyFormat(e.target.value as 'newline' | 'comma' | 'semicolon')
          }
          title="How to separate emails"
        >
          <option value="newline">One per line</option>
          <option value="comma">Comma separated</option>
          <option value="semicolon">Semicolon separated</option>
        </select>
        <button
          type="button"
          onClick={copyEmails}
          disabled={emailCount === 0}
          style={{ width: 'auto', padding: '10px 16px' }}
        >
          Copy emails{emailCount > 0 ? ` (${emailCount})` : ''}
        </button>
        {copyMsg ? (
          <span style={{ fontSize: 13, color: '#6ee7b7' }}>{copyMsg}</span>
        ) : null}
      </div>

      {warning && <div className="message info">{warning}</div>}

      <p className="muted" style={{ textAlign: 'left', padding: '0 0 12px' }}>
        Opens track when images load. Clicks track when a link is followed. Counts update
        from the list and the database.
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
                <th>Opens / Clicks</th>
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
                      {e.click_count && e.click_count > 0
                        ? `clicks ${e.click_count}`
                        : e.open_count && e.open_count > 0
                          ? `opens ${e.open_count}`
                          : '—'}
                      {e.clicked_at
                        ? ` · ${new Date(e.clicked_at).toLocaleString()}`
                        : e.opened_at
                          ? ` · ${new Date(e.opened_at).toLocaleString()}`
                          : ''}
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
