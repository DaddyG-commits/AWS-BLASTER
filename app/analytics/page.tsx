'use client';

import { useCallback, useEffect, useState } from 'react';

type Analytics = {
  overview: {
    total: number;
    sent: number;
    failed: number;
    delivered: number;
    opened: number;
    clicked: number;
    today: number;
    todaySent: number;
    todayFailed: number;
    openRate: number;
    clickRate: number;
    failRate: number;
    leadsTotal: number;
    leadsByStatus: Record<string, number>;
  };
  daily: {
    day: string;
    total: number;
    sent: number;
    failed: number;
    opened: number;
    clicked?: number;
  }[];
  topRecipients: { email: string; count: number }[];
  byType: { type: string; count: number }[];
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to load');
        setData(null);
      } else {
        setData(json as Analytics);
      }
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const o = data?.overview;

  return (
    <div className="container wide">
      <h1>Analytics</h1>
      <p className="subtitle">
        Delivery, opens, clicks, and pipeline — LeadBot-style overview
      </p>

      <div className="row-actions" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button type="button" className="secondary" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="message error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && o && (
        <>
          <div className="stats-row" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <span className="stat-pill">Total {o.total}</span>
            <span className="stat-pill">Sent {o.sent}</span>
            <span className="stat-pill">Opened {o.opened}</span>
            <span className="stat-pill">Clicked {o.clicked ?? 0}</span>
            <span className="stat-pill">Open rate {o.openRate}%</span>
            <span className="stat-pill">Click rate {o.clickRate ?? 0}%</span>
            <span className="stat-pill">Failed {o.failed}</span>
            <span className="stat-pill">Fail rate {o.failRate}%</span>
            <span className="stat-pill">Today {o.todaySent}/{o.today}</span>
            <span className="stat-pill">Prospects {o.leadsTotal}</span>
          </div>

          {o.leadsByStatus && Object.keys(o.leadsByStatus).length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Prospect pipeline</h2>
              <div className="stats-row">
                {Object.entries(o.leadsByStatus).map(([k, v]) => (
                  <span key={k} className="stat-pill">
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div className="card">
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Daily volume</h2>
              {(data?.daily || []).length === 0 ? (
                <p className="muted">No data in range</p>
              ) : (
                <div className="list">
                  {data!.daily.map((d) => (
                    <div key={String(d.day)} className="list-item">
                      <strong>{String(d.day).slice(0, 10)}</strong>
                      <div className="list-meta">
                        {d.sent} sent · {d.opened} opened · {d.clicked ?? 0} clicked ·{' '}
                        {d.failed} failed
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          height: 6,
                          borderRadius: 3,
                          background: '#1e293b',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, d.sent ? (d.opened / d.sent) * 100 : 0)}%`,
                            height: '100%',
                            background: '#22c55e',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Top recipients</h2>
              {(data?.topRecipients || []).length === 0 ? (
                <p className="muted">No sends yet</p>
              ) : (
                <div className="list">
                  {data!.topRecipients.map((r) => (
                    <div key={r.email} className="list-item">
                      <strong>{r.email}</strong>
                      <span className="badge sent">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>By type</h2>
              {(data?.byType || []).length === 0 ? (
                <p className="muted">—</p>
              ) : (
                <div className="list">
                  {data!.byType.map((t) => (
                    <div key={t.type} className="list-item">
                      <strong>{t.type || 'email'}</strong>
                      <span className="badge sent">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
