'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [useQueue, setUseQueue] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [details, setDetails] = useState<
    { recipient: string; success: boolean; error?: string; skipped?: boolean }[]
  >([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadCampaigns]);

  async function processBatches(id: string) {
    setQueueStatus('Processing queue…');
    let remaining = 1;
    let totalSent = 0;
    let totalFailed = 0;

    while (remaining > 0) {
      const res = await fetch('/api/campaigns/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id, maxBatches: 3 }),
      });
      const data = await res.json();
      if (data.error) {
        setQueueStatus(data.error);
        break;
      }
      totalSent += data.sent || 0;
      totalFailed += data.failed || 0;
      remaining = data.remaining ?? 0;
      setQueueStatus(
        `${data.status}: sent +${data.sent} · failed +${data.failed} · remaining ${remaining}`
      );
      if (data.status === 'completed' || remaining === 0) {
        setResult(
          `Queue complete · Sent ~${totalSent} · Failed ~${totalFailed}`
        );
        break;
      }
      // brief pause between multi-batch rounds
      await new Promise((r) => setTimeout(r, 400));
    }
    loadCampaigns();
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult('');
    setDetails([]);
    setQueueStatus('');
    setCampaignId(null);

    try {
      // Background queue path (1k+ safe)
      if (useQueue && !dryRun) {
        const payload: Record<string, unknown> = {
          name,
          subject,
          fromName: fromName.trim() || undefined,
          mode,
          status: leadStatus,
          limit: 10000,
        };
        if (isHtml) payload.html = body;
        else payload.text = body;
        if (mode === 'manual') {
          payload.to = recipients;
        }

        const res = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.error) {
          setResult(data.error);
        } else {
          setCampaignId(data.campaignId);
          setResult(`Queued ${data.total} recipients · id ${data.campaignId}`);
          await processBatches(data.campaignId);
        }
        setLoading(false);
        return;
      }

      // Immediate / dry-run path (small lists)
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
            : `${name}: Sent ${data.sent} · Skipped ${data.skipped || 0} · Failed ${data.failed}`
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
        Bulk blast with background queue (1k+ safe) · personalize {'{{name}}'} {'{{company}}'}{' '}
        {'{{title}}'}
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
            <option value="leads">From Prospects (SEC/CRM)</option>
          </select>
        </div>
        {mode === 'leads' && (
          <div className="form-group">
            <label>Prospect status</label>
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
            <label>Recipients</label>
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
        <div className="form-group">
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={useQueue}
              onChange={(e) => setUseQueue(e.target.checked)}
            />
            Background queue (recommended for 50+ / 1k+ recipients)
          </label>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (immediate preview only, no queue)
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading
            ? 'Working…'
            : dryRun
              ? 'Preview'
              : useQueue
                ? 'Queue & process campaign'
                : 'Launch now'}
        </button>
      </form>

      {queueStatus && <div className="message info">{queueStatus}</div>}
      {result && (
        <div className="message success">{result}</div>
      )}
      {campaignId && (
        <p className="muted">Campaign id: {campaignId}</p>
      )}

      {details.length > 0 && (
        <div className="list" style={{ marginTop: 16 }}>
          {details.map((d) => (
            <div key={d.recipient + (d.error || '')} className="list-item">
              <strong>{d.recipient}</strong>
              <span className={`badge ${d.success ? 'sent' : 'error'}`}>
                {d.skipped ? 'skipped' : d.success ? 'sent' : 'failed'}
              </span>
              {d.error && <div className="list-meta">{d.error}</div>}
            </div>
          ))}
        </div>
      )}

      {campaigns.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18 }}>Recent queued campaigns</h2>
          <div className="list">
            {campaigns.slice(0, 20).map((c) => (
              <div key={c.id} className="list-item">
                <strong>{c.name}</strong>
                <div className="list-meta">
                  {c.status} · {c.sent}/{c.total} sent · {c.failed} failed
                </div>
                {(c.status === 'queued' || c.status === 'sending') && (
                  <button
                    type="button"
                    className="secondary"
                    style={{ marginTop: 8 }}
                    onClick={() => processBatches(c.id)}
                  >
                    Resume processing
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
