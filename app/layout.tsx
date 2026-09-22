import type { Metadata } from 'next';
import './globals.css';
import Nav from './components/Nav';

export const metadata: Metadata = {
  title: 'AWS BLASTER',
  description: 'HTML Email Service — Send, Inbox, Tools, OTP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="page-wrap">{children}</main>
      </body>
    </html>
  );
}
