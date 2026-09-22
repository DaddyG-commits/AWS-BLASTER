'use client';

import { useMemo, useState } from 'react';

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const STRICT_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) || [];
  const unique = Array.from(
    new Set(found.map((e) => e.trim().toLowerCase()))
  );
  return unique.sort();
}

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
  const [raw, setRaw] = useState('');
  const [validateInput, setValidateInput] = useState('');
  const [copied, setCopied] = useState(false);

  const extracted = useMemo(() => extractEmails(raw), [raw]);

  const validationLines = useMemo(() => {
    const lines = validateInput
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.map((email) => ({ email, ...validateEmail(email) }));
  }, [validateInput]);

  const validCount = validationLines.filter((v) => v.valid).length;
  const invalidCount = validationLines.length - validCount;

  const copyExtracted = async () => {
    await navigator.clipboard.writeText(extracted.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="container wide">
      <h1>Extractor &amp; Validator</h1>
      <p className="subtitle">Pull emails from text · check format (lit14-style)</p>

      <div className="tools-grid">
        <div className="tool-card">
          <h2>Email extractor</h2>
          <div className="form-group">
            <label htmlFor="raw">Paste any text, HTML, or list</label>
            <textarea
              id="raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste messy text here… emails will be extracted"
              rows={8}
            />
          </div>
          <div className="stats-row">
            <span className="stat-pill">{extracted.length} unique</span>
          </div>
          {extracted.length > 0 && (
            <>
              <div className="result-box">{extracted.join('\n')}</div>
              <button type="button" className="secondary" onClick={copyExtracted}>
                {copied ? 'Copied!' : 'Copy emails'}
              </button>
            </>
          )}
        </div>

        <div className="tool-card">
          <h2>Email validator</h2>
          <div className="form-group">
            <label htmlFor="validate">One email per line (or comma-separated)</label>
            <textarea
              id="validate"
              value={validateInput}
              onChange={(e) => setValidateInput(e.target.value)}
              placeholder="user@example.com&#10;bad@email&#10;hello@domain.org"
              rows={8}
            />
          </div>
          {validationLines.length > 0 && (
            <>
              <div className="stats-row">
                <span className="stat-pill">{validCount} valid</span>
                <span className="stat-pill">{invalidCount} invalid</span>
              </div>
              <div className="list" style={{ maxHeight: 240, marginTop: 12 }}>
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
      </div>

      <div className="api-info">
        <p>Format validation only — does not check mailbox existence (MX/SMTP probe)</p>
      </div>
    </div>
  );
}
