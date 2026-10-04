'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Customer = {
  id: string;
  email: string;
  name: string;
  note: string;
  last_emailed_at: string;
  send_count: number;
  created_at?: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data.customers || []);
      if (data.warning || data.error) {
        setMessage({ type: 'info', text: data.warning || data.error });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not load customers' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setMessage({ type: 'error', text: 'Enter a valid email' });
      return;
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, name: name.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed' });
        return;
      }
      setCustomers(data.customers || []);
      setEmail('');
      setName('');
      setNote('');
      setMessage({ type: 'success', text: 'Customer saved' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to add customer' });
    }
  };

  const handleSync = async () => {
    setMessage({ type: 'info', text: 'Syncing from sent inbox…' });
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Sync failed' });
        return;
      }
      setCustomers(data.customers || []);
      setMessage({
        type: 'success',
        text: data.message || `Synced (${data.added || 0} new)`,
      });
    } catch {
      setMessage({ type: 'error', text: 'Sync failed' });
    }
  };

  const copyEmails = async () => {
    const list = filtered.map((c) => c.email).join('\n');
    if (!list) return;
    await navigator.clipboard.writeText(list);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="container wide">
      <h1>Customers</h1>
      <p className="subtitle">
        Auto-filled from successful sends · copy list to resend anytime
      </p>

      <form onSubmit={handleAdd}>
        <div className="form-group">
          <label htmlFor="cust-email">Email</label>
          <input
            id="cust-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="cust-name">Name (optional)</label>
          <input
            id="cust-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="form-group">
          <label htmlFor="cust-note">Note (optional)</label>
          <input
            id="cust-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Campaign, product, follow-up…"
          />
        </div>
        <button type="submit">Add customer</button>
      </form>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 24,
          marginBottom: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, name, note…"
          style={{ flex: 1, minWidth: 160 }}
        />
        <button
          type="button"
          className="secondary"
          style={{ width: 'auto', marginTop: 0, padding: '12px 16px' }}
          onClick={handleSync}
        >
          Sync from sent inbox
        </button>
        <button
          type="button"
          className="secondary"
          style={{ width: 'auto', marginTop: 0, padding: '12px 16px' }}
          onClick={copyEmails}
          disabled={filtered.length === 0}
        >
          {copied ? 'Copied!' : 'Copy emails'}
        </button>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(0, 210, 255, 0.15)',
            border: '1px solid rgba(0, 210, 255, 0.35)',
            color: '#00d2ff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          Resend on Send page
        </Link>
      </div>

      <div className="stats-row" style={{ marginBottom: 12 }}>
        <span className="stat-pill">{customers.length} total</span>
        {search.trim() && (
          <span className="stat-pill">{filtered.length} shown</span>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">
          {customers.length === 0
            ? 'No customers yet. Click “Sync from sent inbox” or send a new email.'
            : 'No matches for your search.'}
        </p>
      ) : (
        <div className="list">
          {filtered.map((c) => (
            <div key={c.id} className="list-item">
              <div>
                <strong>{c.email}</strong>
                {c.name && (
                  <span style={{ color: '#ccc', marginLeft: 8 }}>{c.name}</span>
                )}
                <span className="badge sent">{c.send_count || 1} sends</span>
                <div className="list-meta">
                  Last emailed {formatDate(c.last_emailed_at)}
                  {c.note ? ` · ${c.note}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="api-info">
        <p>
          Customers are stored in Neon. Successful sends add them automatically.
          Use <strong>Sync from sent inbox</strong> once to import past recipients.
        </p>
      </div>
    </div>
  );
}
