/**
 * Email pattern generator (LeadBot Pro style).
 * Produces common corporate + Gmail candidates from a person's name.
 */

function cleanName(name: string): { first: string; last: string; parts: string[] } {
  const parts = name
    .replace(/[^a-zA-Z\s\-']/g, ' ')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const first = (parts[0] || 'user').toLowerCase();
  const last = (parts[parts.length - 1] || first).toLowerCase();
  return { first, last, parts: parts.map((p) => p.toLowerCase()) };
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32);
}

export type EmailCandidate = {
  email: string;
  type: 'gmail' | 'corporate';
  pattern: string;
};

export class EmailGenerator {
  static guessDomain(companyName?: string, ticker?: string): string | null {
    if (ticker && /^[A-Z]{1,5}$/i.test(ticker)) {
      return `${ticker.toLowerCase()}.com`;
    }
    if (!companyName) return null;
    const cleaned = companyName
      .replace(/\b(inc|corp|corporation|llc|ltd|co|company|plc|group|holdings)\b/gi, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('')
      .toLowerCase();
    if (cleaned.length < 2) return null;
    return `${cleaned}.com`;
  }

  static generate(
    fullName: string,
    opts?: { domain?: string | null; includeGmail?: boolean }
  ): EmailCandidate[] {
    const { first, last } = cleanName(fullName);
    const f = slug(first);
    const l = slug(last);
    if (!f) return [];

    const out: EmailCandidate[] = [];
    const seen = new Set<string>();

    const push = (local: string, domain: string, type: 'gmail' | 'corporate', pattern: string) => {
      const email = `${local}@${domain}`.toLowerCase();
      if (seen.has(email) || local.length < 2) return;
      seen.add(email);
      out.push({ email, type, pattern });
    };

    const domain = opts?.domain ? opts.domain.replace(/^@/, '').toLowerCase() : null;

    if (domain) {
      push(`${f}.${l}`, domain, 'corporate', 'first.last');
      push(`${f}${l}`, domain, 'corporate', 'firstlast');
      push(`${f[0]}${l}`, domain, 'corporate', 'flast');
      push(`${f}_${l}`, domain, 'corporate', 'first_last');
      push(f, domain, 'corporate', 'first');
    }

    if (opts?.includeGmail !== false) {
      push(`${f}.${l}`, 'gmail.com', 'gmail', 'first.last');
      push(`${f}${l}`, 'gmail.com', 'gmail', 'firstlast');
      push(`${f}.${l}1`, 'gmail.com', 'gmail', 'first.last1');
      push(`${f}${l}${new Date().getFullYear().toString().slice(-2)}`, 'gmail.com', 'gmail', 'firstlastYY');
    }

    return out;
  }
}

export function scoreByTitle(title: string): number {
  let score = 55;
  const t = (title || '').toLowerCase();
  if (/ceo|chief executive|president/.test(t)) score += 25;
  if (/cfo|chief financial|coo|cto|cio|cmo/.test(t)) score += 18;
  if (/director|vice president|\bvp\b/.test(t)) score += 10;
  if (/founder|owner|partner/.test(t)) score += 12;
  return Math.min(score, 100);
}
