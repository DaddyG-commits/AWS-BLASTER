'use client';

import { useMemo, useState } from 'react';

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) || [];
  const unique = Array.from(
    new Set(found.map((e) => e.trim().toLowerCase()))
  );
  return unique.sort();
}

export default function ExtractorPage() {
  const [raw, setRaw] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);

  const extracted = useMemo(() => extractEmails(raw), [raw]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRaw(text);
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    } catch {
      // Clipboard permission denied — user can still paste manually
      setPasted(false);
    }
  };

  const handleCopy = async () => {
    if (extracted.length === 0) return;
    await navigator.clipboard.writeText(extracted.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClear = () => {
    setRaw('');
    setCopied(false);
  };

  return (
    <div className="container wide">
      <h1>Email Extractor</h1>
      <p className="subtitle">
        Paste any text or HTML — unique emails are extracted automatically
      </p>

      <div className="form-group">
        <label htmlFor="raw">Source text</label>
        <textarea
          id="raw"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste messy text, HTML, or a list here…"
          rows={10}
        />
      </div>

      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button type="button" className="secondary" onClick={handlePaste}>
          {pasted ? 'Pasted!' : 'Paste'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={handleCopy}
          disabled={extracted.length === 0}
        >
          {copied ? 'Copied!' : 'Copy emails'}
        </button>
        <button type="button" className="secondary" onClick={handleClear}>
          Clear
        </button>
      </div>

      <div className="stats-row">
        <span className="stat-pill">{extracted.length} unique emails</span>
      </div>

      {extracted.length > 0 && (
        <div className="result-box" style={{ marginTop: 12, maxHeight: 320 }}>
          {extracted.join('\n')}
        </div>
      )}

      {extracted.length === 0 && raw.trim() && (
        <p className="muted">No emails found in the text above</p>
      )}

      <div className="api-info">
        <p>
          Use <strong>Paste</strong> to pull from clipboard, or paste manually.
          <strong> Copy emails</strong> copies the unique list.
        </p>
      </div>
    </div>
  );
}
