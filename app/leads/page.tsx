'use client';

import { useCallback, useEffect, useState } from 'react';

type InboxContact = {
  email: string;
  name: string | null;
  sendCount: number;
  lastSentAt: string;
  lastSubject: string;
};

type CrmLead = {
  id: string;
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  source?: string;
  score?: number;
  status?: string;
};

export default function LeadsPage() {
  /** Default = people from your Sent Inbox (not SEC) */
  const [tab, setTab] = useState<'inbox' | 'prospects'>('inbox');
  const [contacts, setContacts] = useState<InboxContact[]>([]);
  const [prospects, setProspects] = useState<CrmLead[]>([]);
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> }>({
    total: 0,
    byStatus: {},
  });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
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
        // Prefer aggregated contacts from API shape
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

  const loadProspects = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setProspects(data.leads || []);
      setStats(data.stats || { total: 0, byStatus: {} });
    } catch {
      setMsg('Failed to load SEC/CRM prospects');
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    if (tab === 'inbox') loadInbox();
    else loadProspects();
  }, [tab, loadInbox, loadProspects]);

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
      loadInbox();
    } catch {
      setMsg('Sync failed');
      setLoading(false);
    }
  }

  return (
    <div className="container wide">
      <h1>Leads</h1>
      <p className="subtitle">
        Default view: unique people from your <strong>Sent Inbox</strong>.
        Switch to Prospects for SEC extract / CRM pipeline.
      </p>

      <div className="row-actions" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={tab === 'inbox' ? '' : 'secondary'}
          onClick={() => setTab('inbox')}
        >
          From Sent Inbox
        </button>
        <button
          type="button"
          className={tab === 'prospects' ? '' : 'secondary'}
          onClick={() => setTab('prospects')}
        >
          Prospects (SEC / CRM)
        </button>
      </div>

      {tab === 'inbox' && (
        <div className="stats-row" style={{ marginBottom: 12 }}>
          <span className="stat-pill">{meta.totalUnique || contacts.length} unique</span>
          {meta.totalSentLogs > 0 && (
            <span className="stat-pill">{meta.totalSentLogs} sends logged</span>
          )}
        </div>
      )}

      {tab === 'prospects' && (
        <div className="stats-row" style={{ marginBottom: 12 }}>
          <span className="stat-pill">{stats.total} total</span>
          {Object.entries(stats.byStatus || {}).map(([k, v]) => (
            <span key={k} className="stat-pill">
              {k}: {v}
            </span>
          ))}
        </div>
      )}

      <div className="row-actions" style={{ marginBottom: 16, gap: 8, display: 'flex', flexWrap: 'wrap' }}>
        {tab === 'prospects' && (
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="NEW">NEW</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="INVALID">INVALID</option>
          </select>
        )}
        <input
          placeholder="Search email / name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <button
          type="button"
          className="secondary"
          onClick={() => (tab === 'inbox' ? loadInbox() : loadProspects())}
        >
          Refresh
        </button>
        {tab === 'inbox' && (
          <button type="button" className="secondary" onClick={syncFromEmails}>
            Sync from inbox
          </button>
        )}
      </div>

      {msg && <div className="message info">{msg}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : tab === 'inbox' ? (
        contacts.length === 0 ? (
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
        )
      ) : prospects.length === 0 ? (
        <p className="muted">
          No SEC/CRM prospects. Use <strong>SEC Extract</strong> to generate them.
        </p>
      ) : (
        <div className="list">
          {prospects.map((l) => (
            <div key={l.id} className="list-item">
              <strong>{l.name}</strong>
              {l.email && <div>{l.email}</div>}
              <div className="list-meta">
                {[l.title, l.company, l.source].filter(Boolean).join(' · ')}
                {l.score != null && ` · score ${l.score}`}
              </div>
              <span className="badge sent">{l.status || 'NEW'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
