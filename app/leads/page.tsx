'use client';

import { useCallback, useEffect, useState } from 'react';

type InboxContact = {
  email: string;
  name: string | null;
  sendCount: number;
  lastSentAt: string;
  lastSubject: string;
};

export default function LeadsPage() {
  const [contacts, setContacts] = useState<InboxContact[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [meta, setMeta] = useState({ totalUnique: 0, totalSentLogs: 0 });

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('limit', '5000');
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
        setContacts([]);
      } else {
        const list: InboxContact[] = (data.customers || data.contacts || []).map(
          (c: any) => ({
            email: c.email,
            name: c.name || null,
            sendCount: Number(c.send_count || c.sendCount || 1),
            lastSentAt: c.last_emailed_at || c.lastSentAt || '',
            lastSubject: (c.note || c.lastSubject || '').replace(/^Last:\s*/i, ''),
          })
        );
        setContacts(list);
        setMeta({
          totalUnique: data.totalUnique || list.length,
          totalSentLogs: data.totalSentLogs || 0,
        });
      }
    } catch {
      setMsg('Failed to load contacts from sent inbox');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  async function syncFromEmails() {
    setLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync: true }),
      });
      const data = await res.json();
      setMsg(
        data.message ||
          (data.added != null
            ? `Synced ${data.added} new contacts from sent inbox`
            : 'Sync done')
      );
      await loadInbox();
    } catch {
      setMsg('Sync failed');
      setLoading(false);
    }
  }

  return (
    <div className="container wide">
      <h1>Leads</h1>
      <p className="subtitle">
        Unique people from your <strong>Sent Inbox</strong> (successful sends).
      </p>

      <div className="stats-row" style={{ marginBottom: 12 }}>
        <span className="stat-pill">{meta.totalUnique || contacts.length} unique</span>
        {meta.totalSentLogs > 0 && (
          <span className="stat-pill">{meta.totalSentLogs} sends logged</span>
        )}
      </div>

      <div
        className="row-actions"
        style={{ marginBottom: 16, gap: 8, display: 'flex', flexWrap: 'wrap' }}
      >
        <input
          placeholder="Search email / name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <button type="button" className="secondary" onClick={loadInbox}>
          Refresh
        </button>
        <button type="button" className="secondary" onClick={syncFromEmails}>
          Sync from inbox
        </button>
      </div>

      {msg && <div className="message info">{msg}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="muted">
          No contacts yet. Send mail from <strong>Send Email</strong> or{' '}
          <strong>Campaigns</strong>, then tap <strong>Sync from inbox</strong>.
        </p>
      ) : (
        <div className="list">
          {contacts.map((c) => (
            <div key={c.email} className="list-item">
              <strong>{c.name || c.email}</strong>
              <div>{c.email}</div>
              <div className="list-meta">
                {c.sendCount} send{c.sendCount === 1 ? '' : 's'}
                {c.lastSubject ? ` · ${c.lastSubject}` : ''}
                {c.lastSentAt
                  ? ` · ${new Date(c.lastSentAt).toLocaleString()}`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
