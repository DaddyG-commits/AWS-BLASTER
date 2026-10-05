'use client';

import { useCallback, useEffect, useState } from 'react';

type Lead = {
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> }>({
    total: 0,
    byStatus: {},
  });
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setStats(data.stats || { total: 0, byStatus: {} });
    } catch {
      setMsg('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function setupTable() {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup: true }),
    });
    const data = await res.json();
    setMsg(data.ok ? 'Leads table ready' : data.error || 'Setup failed');
    load();
  }

  return (
    <div className="container wide">
      <h1>Leads</h1>
      <p className="subtitle">
        CRM from SEC extract, verify, and imports · {stats.total} total
      </p>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        {Object.entries(stats.byStatus || {}).map(([k, v]) => (
          <span key={k} className="stat-pill">
            {k}: {v}
          </span>
        ))}
      </div>

      <div className="row-actions" style={{ marginBottom: 16, gap: 8, display: 'flex', flexWrap: 'wrap' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="CONTACTED">CONTACTED</option>
          <option value="INVALID">INVALID</option>
        </select>
        <input
          placeholder="Search name / email / company"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <button type="button" className="secondary" onClick={load}>
          Refresh
        </button>
        <button type="button" className="secondary" onClick={setupTable}>
          Ensure table
        </button>
      </div>

      {msg && <div className="message info">{msg}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="muted">
          No leads yet. Use <strong>SEC Extract</strong> or import via API.
        </p>
      ) : (
        <div className="list">
          {leads.map((l) => (
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
