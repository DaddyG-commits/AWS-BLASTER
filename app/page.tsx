'use client';

import { useState } from 'react';

export default function Home() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: `Email sent successfully! Message ID: ${data.messageId}` });
        setTo('');
        setSubject('');
        setBody('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send email' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>AWS BLASTER</h1>
      <p className="subtitle">Zoho Mail SMTP Email Service</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="to">To Email</label>
          <input
            id="to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            required
          />
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
          <label htmlFor="body">Message</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here..."
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Email'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="api-info">
        <p>API Endpoint: <code>POST /api/send</code></p>
        <p>Body: {`{ "to", "subject", "text" | "html" }`}</p>
      </div>
    </div>
  );
}