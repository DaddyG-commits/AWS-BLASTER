/**
 * Free email verification: syntax + MX + disposable/role heuristics.
 * Optional ZeroBounce when ZEROBOUNCE_API_KEY is set.
 */

import dns from 'dns/promises';

const DISPOSABLE = new Set(
  [
    'mailinator.com',
    'guerrillamail.com',
    'tempmail.com',
    '10minutemail.com',
    'yopmail.com',
    'trashmail.com',
    'getnada.com',
    'temp-mail.org',
  ].map((d) => d.toLowerCase())
);

const ROLE_LOCALS = new Set([
  'admin',
  'info',
  'support',
  'sales',
  'contact',
  'help',
  'noreply',
  'no-reply',
  'webmaster',
  'office',
  'billing',
  'hr',
]);

export type VerifyResult = {
  email: string;
  status: 'valid' | 'invalid' | 'disposable' | 'role' | 'risky' | 'unknown';
  score: number;
  reason?: string;
  mx?: boolean;
};

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export async function verifyEmail(raw: string): Promise<VerifyResult> {
  const email = String(raw || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { email, status: 'invalid', score: 0, reason: 'bad syntax' };
  }

  const [local, domain] = email.split('@');

  if (DISPOSABLE.has(domain)) {
    return {
      email,
      status: 'disposable',
      score: 5,
      reason: 'disposable domain',
    };
  }

  if (ROLE_LOCALS.has(local)) {
    return {
      email,
      status: 'role',
      score: 35,
      reason: 'role account',
      mx: true,
    };
  }

  // Optional ZeroBounce
  const zb = process.env.ZEROBOUNCE_API_KEY;
  if (zb) {
    try {
      const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(zb)}&email=${encodeURIComponent(email)}`;
      const res = await fetch(url);
      const data = await res.json();
      const st = String(data.status || '').toLowerCase();
      if (st === 'valid') {
        return { email, status: 'valid', score: 95, reason: 'zerobounce valid', mx: true };
      }
      if (st === 'invalid') {
        return { email, status: 'invalid', score: 5, reason: 'zerobounce invalid' };
      }
      if (st === 'catch-all' || st === 'unknown') {
        return { email, status: 'risky', score: 50, reason: `zerobounce ${st}`, mx: true };
      }
      if (st === 'spamtrap' || st === 'abuse' || st === 'do_not_mail') {
        return { email, status: 'invalid', score: 0, reason: `zerobounce ${st}` };
      }
    } catch (e) {
      console.warn('zerobounce failed', e);
    }
  }

  // MX check
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return { email, status: 'invalid', score: 10, reason: 'no MX', mx: false };
    }
    return {
      email,
      status: 'valid',
      score: domain === 'gmail.com' ? 70 : 75,
      reason: 'syntax + MX ok',
      mx: true,
    };
  } catch {
    return {
      email,
      status: 'unknown',
      score: 40,
      reason: 'MX lookup failed',
      mx: false,
    };
  }
}

export async function verifyMany(emails: string[]): Promise<VerifyResult[]> {
  const out: VerifyResult[] = [];
  for (const e of emails.slice(0, 50)) {
    out.push(await verifyEmail(e));
  }
  return out;
}
