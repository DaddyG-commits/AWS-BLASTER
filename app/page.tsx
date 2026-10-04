'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

function parseEmails(raw: string): string[] {
  const list = raw
    .split(/[,;\s\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@') && e.includes('.'));
  return Array.from(new Set(list));
}

export default function Home() {
  const [to, setTo] = useState('');
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isHtml, setIsHtml] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [details, setDetails] = useState<
    { recipient: string; success: boolean; error?: string }[]
  >([]);

  const recipientCount = useMemo(() => parseEmails(to).length, [to]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setDetails([]);

    const emails = parseEmails(to);
    if (!emails.length) {
      setMessage({ type: 'error', text: 'No valid emails found in the To box' });
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        to: emails,
        subject,
        fromName: fromName.trim() || undefined,
      };

      if (isHtml) {
        payload.html = body;
      } else {
        payload.text = body;
      }

      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.results) {
        setDetails(data.results);
      }

      if (res.ok && data.sent > 0) {
        let text = `Sent ${data.sent} · Failed ${data.failed} · Total ${data.total}`;
        if (data.logged === false || data.database === false) {
          text +=
            ' · Inbox not logging yet (set DATABASE_URL + run schema.sql on Neon)';
        }
        setMessage({
          type: data.failed || data.logged === false ? 'info' : 'success',
          text,
        });
        // Keep subject + HTML body so you can resend. Only clear To list.
        setTo('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || data.message || 'Failed to send email',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`container ${isHtml && showPreview ? 'wide' : ''}`}>
      <h1>CryptoByt</h1>
      <p className="subtitle">Send HTML or plain email · logged to inbox</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fromName">From Name</label>
          <input
            id="fromName"
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="e.g. John from Acme, Alex Support"
          />
          <small style={{ color: '#888', fontSize: '0.8rem' }}>
            Name the recipient will see
          </small>
        </div>

        <div className="form-group">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <label htmlFor="to" style={{ margin: 0 }}>
              To Email(s)
            </label>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: recipientCount > 0 ? '#00d2ff' : '#888',
                background: 'rgba(0, 210, 255, 0.12)',
                border: '1px solid rgba(0, 210, 255, 0.25)',
                padding: '3px 10px',
                borderRadius: 999,
              }}
            >
              {recipientCount} email{recipientCount === 1 ? '' : 's'}
            </span>
          </div>
          <textarea
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Paste emails — one per line or comma-separated"
            required
            rows={4}
            style={{ resize: 'vertical', minHeight: 90 }}
          />
          <small style={{ color: '#888', fontSize: '0.8rem' }}>
            Count updates as you paste. Duplicates are removed automatically.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            required
          />
        </div>

        <div className="form-group">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <label htmlFor="body" style={{ margin: 0 }}>
              Message
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isHtml}
                  onChange={(e) => setIsHtml(e.target.checked)}
                />
                HTML Mode
              </label>
              {isHtml && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showPreview}
                    onChange={(e) => setShowPreview(e.target.checked)}
                  />
                  Preview
                </label>
              )}
            </div>
          </div>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              isHtml ? 'Paste your HTML here…' : 'Write your message here…'
            }
            required
            rows={isHtml && showPreview ? 10 : 8}
          />
        </div>

        {isHtml && showPreview && (
          <div className="form-group">
            <label>HTML Preview</label>
            <div className="html-preview-frame">
              {body.trim() ? (
                <iframe
                  title="HTML email preview"
                  className="html-preview-iframe"
                  srcDoc={body}
                  sandbox=""
                />
              ) : (
                <div className="html-preview-empty">
                  Paste HTML above to see a live preview
                </div>
              )}
            </div>
          </div>
        )}

        <button type="submit" disabled={loading || recipientCount === 0}>
          {loading
            ? `Sending ${recipientCount}…`
            : recipientCount > 0
              ? `Send ${recipientCount} email${recipientCount === 1 ? '' : 's'}`
              : 'Send Email'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {details.length > 0 && (
        <div className="list" style={{ marginTop: 14 }}>
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

      <div className="api-info">
        <p>
          <Link href="/inbox" style={{ color: '#00d2ff' }}>
            Open Sent Inbox
          </Link>
          {' · '}
          <Link href="/dashboard" style={{ color: '#00d2ff' }}>
            Dashboard
          </Link>
          {' · '}
          <Link href="/campaigns" style={{ color: '#00d2ff' }}>
            Campaigns
          </Link>
        </p>
      </div>
    </div>
  );
}
