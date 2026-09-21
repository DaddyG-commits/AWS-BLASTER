import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AWS BLASTER - Zoho SMTP Email Service',
  description: 'Fully functional SMTP email sending service powered by Zoho Mail, deployed on Vercel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}