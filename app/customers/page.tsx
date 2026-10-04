'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'cryptobyt_customers';

type Customer = {
  id: string;
  email: string;
  name: string;
  note: string;
  emailedAt: string;
};

function loadCustomers(): Customer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomers(list: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCustomers(loadCustomers());
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const persist = (next: Customer[]) => {
    setCustomers(next);
    saveCustomers(next);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setMessage({ type: 'error', text: 'Enter a valid email' });
      return;
    }
    if (customers.some((c) => c.email === em)) {
      setMessage({ type: 'error', text: 'This email is already in the list' });
      return;
    }

    const entry: Customer = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: em,
      name: name.trim(),
      note: note.trim(),
      emailedAt: new Date().toISOString(),
    };

    persist([entry, ...customers]);
    setEmail('');
    setName('');
    setNote('');
    setMessage({ type: 'success', text: 'Customer added' });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleRemove = (id: string) => {
    persist(customers.filter((c) => c.id !== id));
  };

  const handleClearAll = () => {
    if (!confirm('Remove all customers from this list?')) return;
    persist([]);
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
        Track people you have already emailed (saved in this browser)
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
          onClick={copyEmails}
          disabled={filtered.length === 0}
        >
          {copied ? 'Copied!' : 'Copy emails'}
        </button>
        <button
          type="button"
          className="secondary danger"
          style={{ width: 'auto', marginTop: 0, padding: '12px 16px' }}
          onClick={handleClearAll}
          disabled={customers.length === 0}
        >
          Clear all
        </button>
      </div>

      <div className="stats-row" style={{ marginBottom: 12 }}>
        <span className="stat-pill">{customers.length} total</span>
        {search.trim() && (
          <span className="stat-pill">{filtered.length} shown</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="muted">
          {customers.length === 0
            ? 'No customers yet. Add emails you have already contacted.'
            : 'No matches for your search.'}
        </p>
      ) : (
        <div className="list">
          {filtered.map((c) => (
            <div key={c.id} className="list-item">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <strong>{c.email}</strong>
                  {c.name && (
                    <span style={{ color: '#ccc', marginLeft: 8 }}>
                      {c.name}
                    </span>
                  )}
                  <div className="list-meta">
                    Added {formatDate(c.emailedAt)}
                    {c.note ? ` · ${c.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary danger"
                  style={{
                    width: 'auto',
                    marginTop: 0,
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                  }}
                  onClick={() => handleRemove(c.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="api-info">
        <p>
          Data stays in your browser (localStorage). Clearing site data will
          remove this list.
        </p>
      </div>
    </div>
  );
}
