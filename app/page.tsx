'use client';

import { useState } from 'react';

export default function Home() {
  const [to, setTo] = useState('');
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isHtml, setIsHtml] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: any = {
        to: to
          .split(',')
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

      if (res.ok) {
        setMessage({
          type: 'success',
          text: 'Email sent successfully',
        });
        setTo('');
        setSubject('');
        setBody('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to send email',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>AWS BLASTER</h1>
      <p className="subtitle">Send HTML or plain email via Gmail</p>

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
            Separate multiple emails with commas
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
            }}
          >
            <label htmlFor="body" style={{ margin: 0 }}>
              Message
            </label>
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
          </div>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              isHtml ? 'Paste your HTML here…' : 'Write your message here…'
            }
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send Email'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="api-info">
        <p>Use the menu for Inbox, Tools, and OTP</p>
      </div>
    </div>
  );
}
