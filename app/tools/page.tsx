'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const STRICT_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateEmail(email: string) {
  const e = email.trim();
  if (!e) return { valid: false, reason: 'Empty' };
  if (e.length > 254) return { valid: false, reason: 'Too long' };
  if (!STRICT_RE.test(e)) return { valid: false, reason: 'Invalid format' };
  const [local, domain] = e.split('@');
  if (!local || !domain) return { valid: false, reason: 'Missing parts' };
  if (local.length > 64) return { valid: false, reason: 'Local part too long' };
  if (local.startsWith('.') || local.endsWith('.'))
    return { valid: false, reason: 'Local part edge dots' };
  if (local.includes('..') || domain.includes('..'))
    return { valid: false, reason: 'Consecutive dots' };
  if (!domain.includes('.')) return { valid: false, reason: 'Domain needs TLD' };
  return { valid: true, reason: 'OK' };
}

export default function ToolsPage() {
  const [validateInput, setValidateInput] = useState('');

  const validationLines = useMemo(() => {
    const lines = validateInput
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.map((email) => ({ email, ...validateEmail(email) }));
  }, [validateInput]);

  const validCount = validationLines.filter((v) => v.valid).length;
  const invalidCount = validationLines.length - validCount;

  return (
    <div className="container wide">
      <h1>Email Validator</h1>
      <p className="subtitle">
        Check email format ·{' '}
        <Link href="/extractor" style={{ color: '#00d2ff' }}>
          open Extractor
        </Link>{' '}
        for pulling emails from text
      </p>

      <div className="tool-card">
        <h2>Validate emails</h2>
        <div className="form-group">
          <label htmlFor="validate">One email per line (or comma-separated)</label>
          <textarea
            id="validate"
            value={validateInput}
            onChange={(e) => setValidateInput(e.target.value)}
            placeholder="user@example.com&#10;bad@email&#10;hello@domain.org"
            rows={10}
          />
        </div>
        {validationLines.length > 0 && (
          <>
            <div className="stats-row">
              <span className="stat-pill">{validCount} valid</span>
              <span className="stat-pill">{invalidCount} invalid</span>
            </div>
            <div className="list" style={{ maxHeight: 320, marginTop: 12 }}>
              {validationLines.map((v, i) => (
                <div key={`${v.email}-${i}`} className="list-item">
                  <div>
                    <strong>{v.email}</strong>
                    <span className={`badge ${v.valid ? 'delivered' : 'error'}`}>
                      {v.valid ? 'valid' : 'invalid'}
                    </span>
                  </div>
                  <div className="list-meta">{v.reason}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="api-info">
        <p>
          Format validation only — does not check mailbox existence (MX/SMTP
          probe)
        </p>
      </div>
    </div>
  );
}
