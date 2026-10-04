'use client';

import { useState } from 'react';
import Link from 'next/link';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setDetails([]);

    try {
      const payload: Record<string, unknown> = {
        to: to
          .split(/[,;\s\n]+/)
          .map((email) => email.trim())
          .filter(Boolean),
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
        setMessage({
          type: data.failed ? 'info' : 'success',
          text: `Sent ${data.sent} · Failed ${data.failed} · Total ${data.total}`,
        });
        if (data.failed === 0) {
          setTo('');
          setSubject('');
          setBody('');
        }
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
          <label htmlFor="to">To Email(s)</label>
          <textarea
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com, another@example.com"
            required
            rows={3}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
          <small style={{ color: '#888', fontSize: '0.8rem' }}>
            Separate with commas or new lines — each is logged separately
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

        <button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send Email'}
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
