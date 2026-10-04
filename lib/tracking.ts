/** Public base URL used inside emails (must be your live HTTPS domain) */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;
  if (explicit) {
    let u = explicit.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Inject open-tracking pixel.
 * Important: do NOT use display:none — many clients strip those images.
 * Use a real 1×1 img so Gmail/Outlook still request it when the message is opened.
 */
export function injectOpenPixel(html: string, emailId: string): string {
  if (!html || !emailId) return html;
  if (html.includes('/api/track/open?id=')) return html;

  const base = getAppBaseUrl();
  const src = `${base}/api/track/open?id=${encodeURIComponent(emailId)}&t=${Date.now()}`;

  // 1×1 transparent GIF — width/height attributes help clients load it
  const pixel = `
<img src="${src}" width="1" height="1" alt="" border="0"
  style="width:1px;height:1px;border:0;overflow:hidden;opacity:0;" />`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}\n</body>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${pixel}\n</html>`);
  }
  return `${html}${pixel}`;
}

/** Optional: rewrite http(s) links so clicks can be tracked later */
export function injectClickTracking(html: string, emailId: string): string {
  if (!html || !emailId) return html;
  const base = getAppBaseUrl();

  return html.replace(
    /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi,
    (_m, url: string) => {
      // Don't wrap our own tracking URLs
      if (url.includes('/api/track/')) return `href="${url}"`;
      const tracked = `${base}/api/track/click?id=${encodeURIComponent(emailId)}&u=${encodeURIComponent(url)}`;
      return `href="${tracked}"`;
    }
  );
}

export const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
