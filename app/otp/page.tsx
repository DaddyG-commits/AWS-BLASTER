'use client';

import { useState } from 'react';

export default function OtpPage() {
  const [to, setTo] = useState('');
  const [fromName, setFromName] = useState('');
  const [subject, setSubject] = useState('Your verification code');
  const [length, setLength] = useState(6);
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [lastOtp, setLastOtp] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setLastOtp(null);

    try {
      const res = await fetch('/api/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          fromName: fromName.trim() || undefined,
          subject: subject.trim() || undefined,
          length,
          message: customMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastOtp(data.otp || null);
        setMessage({
          type: 'success',
          text: 'OTP sent successfully',
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to send OTP',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send OTP' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>OTP Sender</h1>
      <p className="subtitle">Generate &amp; email a one-time code via Gmail</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="to">Recipient email</label>
          <input
            id="to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="fromName">From name (optional)</label>
          <input
            id="fromName"
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Security Team"
          />
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your verification code"
          />
        </div>

        <div className="form-group">
          <label htmlFor="length">Code length</label>
          <select
            id="length"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          >
            <option value={4}>4 digits</option>
            <option value={6}>6 digits</option>
            <option value={8}>8 digits</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="customMessage">
            Custom text (optional — use {'{{otp}}'} placeholder)
          </label>
          <textarea
            id="customMessage"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Your code is {{otp}}. Do not share it."
            rows={3}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send OTP'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {lastOtp && (
        <div className="message info" style={{ marginTop: 12 }}>
          Code for testing:{' '}
          <strong style={{ letterSpacing: 3 }}>{lastOtp}</strong>
        </div>
      )}
    </div>
  );
}
