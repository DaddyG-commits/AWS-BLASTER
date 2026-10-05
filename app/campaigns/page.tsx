'use client';

import { useState } from 'react';

export default function CampaignsPage() {
  const [name, setName] = useState('Campaign');
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('Hello {{name}}');
  const [body, setBody] = useState(
    '<p>Hi {{name}},</p><p>Quick note regarding {{company}}.</p><p>Best,<br/>CryptoByt</p>'
  );
  const [recipients, setRecipients] = useState('');
  const [isHtml, setIsHtml] = useState(true);
  const [mode, setMode] = useState<'manual' | 'leads'>('manual');
  const [leadStatus, setLeadStatus] = useState('NEW');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [details, setDetails] = useState<
    { recipient: string; success: boolean; error?: string; skipped?: boolean }[]
  >([]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult('');
    setDetails([]);

    try {
      const payload: Record<string, unknown> = {
        subject,
        fromName: fromName.trim() || undefined,
        campaignId: `cmp-${Date.now()}`,
        dryRun,
        mode,
        status: leadStatus,
        force: true,
      };
      if (isHtml) payload.html = body;
      else payload.text = body;

      if (mode === 'manual') {
        const list = recipients
          .split(/[,;\n]+/)
          .map((x) => x.trim())
          .filter((x) => x.includes('@') || x.includes('<'));
        if (!list.length) {
          setResult('Add at least one recipient');
          setLoading(false);
          return;
        }
        payload.to = list;
      }

      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.dryRun) {
        setResult(`Dry run: would send ${data.wouldSend}`);
        setDetails(
          (data.recipients || []).map((r: any) => ({
            recipient: r.email,
            success: true,
            error: r.subject,
          }))
        );
      } else {
        setResult(
          data.error
            ? data.error
            : `${name}: Sent ${data.sent} · Skipped ${data.skipped || 0} · Failed ${data.failed} · Total ${data.total}`
        );
        setDetails(data.results || []);
      }
    } catch {
      setResult('Campaign failed to run');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container wide">
      <h1>Campaigns</h1>
      <p className="subtitle">
        Bulk blast · personalize with {'{{name}}'} {'{{company}}'} {'{{title}}'} {'{{email}}'} ·
        suppression + open tracking
      </p>

      <form onSubmit={run}>
        <div className="form-group">
          <label>Campaign name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'manual' | 'leads')}
          >
            <option value="manual">Manual list</option>
            <option value="leads">From Leads (CRM)</option>
          </select>
        </div>
        {mode === 'leads' && (
          <div className="form-group">
            <label>Lead status filter</label>
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
            >
              <option value="NEW">NEW</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="CONTACTED">CONTACTED</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>From name</label>
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="CryptoByt"
          />
        </div>
        {mode === 'manual' && (
          <div className="form-group">
            <label>Recipients (one per line · Name &lt;email&gt; supported)</label>
            <textarea
              rows={6}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Jane Doe <jane@mail.com>\nb@mail.com"
              required={mode === 'manual'}
            />
          </div>
        )}
        <div className="form-group">
          <label>Subject (supports {'{{name}}'})</label>
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
        <div className="form-group">
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (preview only)
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Running…' : dryRun ? 'Preview campaign' : 'Launch campaign'}
        </button>
      </form>

      {result && (
        <div
          className={`message ${
            result.includes('Failed') && !result.includes('Sent 0')
              ? 'info'
              : result.includes('Sent') || result.includes('Dry')
                ? 'success'
                : 'error'
          }`}
        >
          {result}
        </div>
      )}

      {details.length > 0 && (
        <div className="list" style={{ marginTop: 16 }}>
          {details.map((d) => (
            <div key={d.recipient + (d.error || '')} className="list-item">
              <strong>{d.recipient}</strong>
              <span
                className={`badge ${
                  d.success ? (d.skipped ? 'info' : 'sent') : 'error'
                }`}
              >
                {d.skipped ? 'skipped' : d.success ? 'sent' : 'failed'}
              </span>
              {d.error && <div className="list-meta">{d.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
