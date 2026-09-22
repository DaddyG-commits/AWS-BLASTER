'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const LINKS = [
  { href: '/', label: 'Send Email' },
  { href: '/tools', label: 'Extractor & Validator' },
  { href: '/otp', label: 'OTP Sender' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    LINKS.find((l) =>
      l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
    )?.label || 'Menu';

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="nav-bar" ref={ref}>
      <Link href="/" className="nav-brand">
        AWS BLASTER
      </Link>
      <div className="nav-dropdown">
        <button
          type="button"
          className="nav-dropdown-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {current}
          <span className="nav-caret">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="nav-menu">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  (l.href === '/' ? pathname === '/' : pathname.startsWith(l.href))
                    ? 'nav-item active'
                    : 'nav-item'
                }
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
