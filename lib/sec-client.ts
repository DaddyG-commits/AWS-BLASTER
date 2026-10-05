/**
 * Lightweight SEC EDGAR client for executive extraction (LeadBot Pro parity).
 * Requires SEC_USER_AGENT env (e.g. "CryptoByt (you@domain.com)").
 */

const SEC_BASE = 'https://data.sec.gov';

function userAgent() {
  return (
    process.env.SEC_USER_AGENT ||
    process.env.USER_AGENT ||
    'CryptoByt (contact@example.com)'
  );
}

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent': userAgent(),
      Accept: 'application/json, text/html, */*',
    },
    next: { revalidate: 0 },
  } as any);
}

export type SecExecutive = {
  name: string;
  title: string;
};

export type SecCompany = {
  cik: string;
  name: string;
  ticker?: string;
};

function padCik(cik: string): string {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

export const secClient = {
  async getCompany(cik: string): Promise<SecCompany | null> {
    const clean = padCik(cik);
    try {
      const res = await secFetch(
        `${SEC_BASE}/submissions/CIK${clean}.json`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const tickers = data.tickers || [];
      return {
        cik: clean,
        name: data.name || `CIK ${clean}`,
        ticker: tickers[0],
      };
    } catch (e) {
      console.error('sec getCompany', e);
      return null;
    }
  },

  async searchCompanies(query: string): Promise<SecCompany[]> {
    // Use SEC company tickers JSON (cached publicly)
    try {
      const res = await secFetch(
        'https://www.sec.gov/files/company_tickers.json'
      );
      if (!res.ok) return [];
      const data = await res.json();
      const q = query.toLowerCase().trim();
      const out: SecCompany[] = [];
      for (const key of Object.keys(data)) {
        const row = data[key];
        const name = String(row.title || '');
        const ticker = String(row.ticker || '');
        if (
          name.toLowerCase().includes(q) ||
          ticker.toLowerCase() === q
        ) {
          out.push({
            cik: String(row.cik_str).padStart(10, '0'),
            name,
            ticker,
          });
        }
        if (out.length >= 25) break;
      }
      return out;
    } catch (e) {
      console.error('sec search', e);
      return [];
    }
  },

  /**
   * Extract executive-like names from recent filing text (10-K / DEF 14A style).
   * Heuristic parser — good enough for lead gen patterns.
   */
  async extractExecutives(
    cik: string,
    filingType = '10-K'
  ): Promise<SecExecutive[]> {
    const clean = padCik(cik);
    try {
      const subRes = await secFetch(
        `${SEC_BASE}/submissions/CIK${clean}.json`
      );
      if (!subRes.ok) return [];
      const sub = await subRes.json();
      const recent = sub.filings?.recent;
      if (!recent?.form) return [];

      let accession: string | null = null;
      let primaryDoc: string | null = null;

      for (let i = 0; i < recent.form.length; i++) {
        if (String(recent.form[i]).toUpperCase().includes(filingType.toUpperCase())) {
          accession = String(recent.accessionNumber[i]).replace(/-/g, '');
          primaryDoc = recent.primaryDocument[i];
          break;
        }
      }

      if (!accession || !primaryDoc) return [];

      const cikNum = String(parseInt(clean, 10));
      const docUrl = `${SEC_BASE}/Archives/edgar/data/${cikNum}/${accession}/${primaryDoc}`;
      const docRes = await secFetch(docUrl);
      if (!docRes.ok) return [];
      let text = await docRes.text();
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ');

      const execs: SecExecutive[] = [];
      const seen = new Set<string>();

      // Patterns: "John A. Smith, Chief Executive Officer"
      const patterns = [
        /([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)+)\s*[,\-]\s*((?:Chief\s+\w+(?:\s+Officer)?|President|CEO|CFO|COO|CTO|CIO|CMO|Vice\s+President|Director|Founder|Chairman)[^.;]{0,60})/g,
        /((?:Chief\s+\w+(?:\s+Officer)?|President|CEO|CFO|COO|CTO)\s*[:\-]\s*)([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)+)/g,
      ];

      for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          let name = '';
          let title = '';
          if (m[1] && /Chief|President|CEO|CFO|Director|Vice|Founder|Chairman/i.test(m[1])) {
            title = m[1].replace(/[:\-]/g, '').trim();
            name = m[2]?.trim() || '';
          } else {
            name = m[1]?.trim() || '';
            title = m[2]?.trim() || 'Executive';
          }
          name = name.replace(/\s+/g, ' ').slice(0, 80);
          title = title.replace(/\s+/g, ' ').slice(0, 80);
          if (name.split(' ').length < 2) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          execs.push({ name, title });
          if (execs.length >= 40) break;
        }
        if (execs.length >= 40) break;
      }

      return execs;
    } catch (e) {
      console.error('extractExecutives', e);
      return [];
    }
  },
};
