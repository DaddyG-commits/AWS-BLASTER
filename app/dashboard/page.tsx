'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Stats = {
  total: number;
  sent: number;
  failed: number;
  otp: number;
  email: number;
  today: number;
  todaySent: number;
  todayFailed: number;
  database?: boolean;
  mailConfigured?: boolean;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const successRate =
    stats && stats.total > 0
      ? Math.round((stats.sent / stats.total) * 100)
      : 0;

  return (
    <div className="container wide">
      <h1>Dashboard</h1>
      <p className="subtitle">Live delivery counts · LeadBot-style overview</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.total ?? '—'}</div>
          <div className="stat-label">All time</div>
        </div>
        <div className="stat-card ok">
          <div className="stat-value">{stats?.sent ?? '—'}</div>
          <div className="stat-label">Sent</div>
        </div>
        <div className="stat-card bad">
          <div className="stat-value">{stats?.failed ?? '—'}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{successRate}%</div>
          <div className="stat-label">Success rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.todaySent ?? '—'}</div>
          <div className="stat-label">Sent today</div>
        </div>
        <div className="stat-card bad">
          <div className="stat-value">{stats?.todayFailed ?? '—'}</div>
          <div className="stat-label">Failed today</div>
        </div>
      </div>

      <div className="quota-card" style={{ marginTop: 8 }}>
        <div className="quota-row">
          <span>Mail (Gmail)</span>
          <strong>{stats?.mailConfigured ? 'Configured' : 'Not configured'}</strong>
        </div>
        <div className="quota-row">
          <span>Database (inbox log)</span>
          <strong>{stats?.database ? 'Connected' : 'Missing DATABASE_URL'}</strong>
        </div>
        <div className="quota-row">
          <span>OTP total</span>
          <strong>{stats?.otp ?? 0}</strong>
        </div>
        <div className="quota-row" style={{ marginBottom: 0 }}>
          <span>Email total</span>
          <strong>{stats?.email ?? 0}</strong>
        </div>
      </div>

      <div className="tools-grid" style={{ marginTop: 20 }}>
        <Link href="/" className="tool-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>Send Email</h2>
          <p className="muted" style={{ textAlign: 'left' }}>
            HTML / plain multi-recipient send with logging
          </p>
        </Link>
        <Link href="/inbox" className="tool-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>Inbox</h2>
          <p className="muted" style={{ textAlign: 'left' }}>
            Browse sent and failed with filters
          </p>
        </Link>
        <Link href="/campaigns" className="tool-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>Campaigns</h2>
          <p className="muted" style={{ textAlign: 'left' }}>
            Bulk blast with per-recipient results
          </p>
        </Link>
        <Link href="/otp" className="tool-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h2>OTP</h2>
          <p className="muted" style={{ textAlign: 'left' }}>
            Verification codes with delivery log
          </p>
        </Link>
      </div>
    </div>
  );
}
