/** Build public base URL for tracking pixel */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/** Invisible 1×1 open-tracking pixel injected into HTML emails */
export function injectOpenPixel(html: string, emailId: string): string {
  if (!html || !emailId) return html;
  if (html.includes('/api/track/open')) return html;

  const base = getAppBaseUrl();
  const src = `${base}/api/track/open?id=${encodeURIComponent(emailId)}`;
  const pixel = `<img src="${src}" width="1" height="1" alt="" style="display:none!important;width:1px;height:1px;border:0;" />`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${html}${pixel}`;
}

/** 1×1 transparent GIF bytes */
export const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
