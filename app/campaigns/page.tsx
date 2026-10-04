'use client';

import { useState } from 'react';

export default function CampaignsPage() {
  const [name, setName] = useState('Campaign');
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isHtml, setIsHtml] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [details, setDetails] = useState<
    { recipient: string; success: boolean; error?: string }[]
  >([]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult('');
    setDetails([]);

    const list = recipients
      .split(/[,;\s\n]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.includes('@'));

    if (!list.length) {
      setResult('Add at least one recipient');
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        to: list,
        subject,
        fromName: fromName.trim() || undefined,
        campaignId: `cmp-${Date.now()}`,
      };
      if (isHtml) payload.html = body;
      else payload.text = body;

      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      setResult(
        data.error
          ? data.error
          : `${name}: Sent ${data.sent} · Failed ${data.failed} · Total ${data.total}`
      );
      setDetails(data.results || []);
    } catch {
      setResult('Campaign failed to run');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container wide">
      <h1>Campaigns</h1>
      <p className="subtitle">Bulk send · each recipient logged as sent or failed</p>

      <form onSubmit={run}>
        <div className="form-group">
          <label>Campaign name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>From name</label>
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="CryptoByt"
          />
        </div>
        <div className="form-group">
          <label>Recipients (one per line or comma-separated)</label>
          <textarea
            rows={6}
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="a@mail.com\nb@mail.com"
            required
          />
        </div>
        <div className="form-group">
          <label>Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={isHtml}
              onChange={(e) => setIsHtml(e.target.checked)}
            />
            HTML body
          </label>
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending campaign…' : 'Launch campaign'}
        </button>
      </form>

      {result && (
        <div className={`message ${result.includes('Failed') && !result.includes('Sent 0') ? 'info' : result.startsWith('Campaign') || result.includes('Sent') ? 'success' : 'error'}`}>
          {result}
        </div>
      )}

      {details.length > 0 && (
        <div className="list" style={{ marginTop: 16 }}>
          {details.map((d) => (
            <div key={d.recipient} className="list-item">
              <strong>{d.recipient}</strong>
              <span className={`badge ${d.success ? 'sent' : 'error'}`}>
                {d.success ? 'sent' : 'failed'}
              </span>
              {d.error && <div className="list-meta">{d.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
