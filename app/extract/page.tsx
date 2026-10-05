'use client';

import { useState } from 'react';

export default function SecExtractPage() {
  const [cik, setCik] = useState('');
  const [q, setQ] = useState('');
  const [companies, setCompanies] = useState<
    { cik: string; name: string; ticker?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [leads, setLeads] = useState<any[]>([]);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sec/extract?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch {
      setResult('Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function extract(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult('');
    setLeads([]);
    try {
      const res = await fetch('/api/sec/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cik, generateCount: 20, save: true }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(data.error);
      } else {
        setResult(
          `${data.company} · ${data.filingUsed} · ${data.saved} leads saved (from ${data.totalExtracted} execs)`
        );
        setLeads(data.leads || []);
      }
    } catch {
      setResult('Extract failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container wide">
      <h1>SEC Extract</h1>
      <p className="subtitle">
        Pull executives from EDGAR filings → generate email patterns → save leads
      </p>

      <div className="form-group">
        <label>Search company / ticker</label>
        <div className="row-actions" style={{ display: 'flex', gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Apple or AAPL"
            style={{ flex: 1 }}
          />
          <button type="button" className="secondary" onClick={search} disabled={loading}>
            Search
          </button>
        </div>
      </div>

      {companies.length > 0 && (
        <div className="list" style={{ marginBottom: 16 }}>
          {companies.map((c) => (
            <div
              key={c.cik}
              className="list-item"
              style={{ cursor: 'pointer' }}
              onClick={() => setCik(c.cik)}
            >
              <strong>{c.name}</strong>
              <div className="list-meta">
                CIK {c.cik} {c.ticker ? `· ${c.ticker}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={extract}>
        <div className="form-group">
          <label>CIK</label>
          <input
            value={cik}
            onChange={(e) => setCik(e.target.value)}
            placeholder="0000320193"
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Extracting…' : 'Extract & save leads'}
        </button>
      </form>

      {result && (
        <div className={`message ${result.includes('failed') || result.includes('No ') || result.includes('Set ') ? 'error' : 'success'}`}>
          {result}
        </div>
      )}

      {leads.length > 0 && (
        <div className="list" style={{ marginTop: 16 }}>
          {leads.map((l: any, i: number) => (
            <div key={l.email || i} className="list-item">
              <strong>{l.name}</strong>
              <div>{l.email}</div>
              <div className="list-meta">
                {l.title} · {l.company} · score {l.score}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="api-info">
        <p>
          Requires <code>SEC_USER_AGENT</code> and <code>DATABASE_URL</code> on
          Vercel. After extract, open <strong>Leads</strong> or campaign with{' '}
          <code>mode: &quot;leads&quot;</code>.
        </p>
      </div>
    </div>
  );
}
