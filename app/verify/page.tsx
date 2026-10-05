'use client';

import { useState } from 'react';

export default function VerifyPage() {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult('');
    setRows([]);
    const emails = raw
      .split(/[,;\s\n]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.includes('@'));

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          emails.length === 1 ? { email: emails[0] } : { emails }
        ),
      });
      const data = await res.json();
      if (data.error) {
        setResult(data.error);
      } else if (data.result) {
        setResult(`${data.result.email}: ${data.result.status} (${data.result.score})`);
        setRows([data.result]);
      } else {
        setResult(
          `Valid ${data.summary?.valid} · Invalid ${data.summary?.invalid} · Risky ${data.summary?.risky}`
        );
        setRows(data.results || []);
      }
    } catch {
      setResult('Verify failed');
    } finally {
      setLoading(false);
    }
  }

  async function fromLeads() {
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromLeads: true, limit: 25 }),
      });
      const data = await res.json();
      if (data.error) setResult(data.error);
      else {
        setResult(
          `From leads · Valid ${data.summary?.valid} · Invalid ${data.summary?.invalid}`
        );
        setRows(data.results || []);
      }
    } catch {
      setResult('Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container wide">
      <h1>Email Verify</h1>
      <p className="subtitle">
        Syntax + MX + disposable/role · optional ZeroBounce
      </p>

      <form onSubmit={run}>
        <div className="form-group">
          <label>Emails</label>
          <textarea
            rows={6}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="one@mail.com\ntwo@mail.com"
            required
          />
        </div>
        <div className="row-actions" style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Verify'}
          </button>
          <button type="button" className="secondary" onClick={fromLeads} disabled={loading}>
            Verify NEW leads
          </button>
        </div>
      </form>

      {result && <div className="message info">{result}</div>}

      {rows.length > 0 && (
        <div className="list" style={{ marginTop: 16 }}>
          {rows.map((r) => (
            <div key={r.email} className="list-item">
              <strong>{r.email}</strong>
              <span className={`badge ${r.status === 'valid' ? 'sent' : 'error'}`}>
                {r.status}
              </span>
              <div className="list-meta">
                score {r.score} · {r.reason}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
