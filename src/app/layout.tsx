import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { appStrings } from '@/lib/strings/app';
import './globals.css';

export const metadata: Metadata = {
  title: appStrings.name,
  description: appStrings.description,
  applicationName: appStrings.name,
  appleWebApp: {
    capable: true,
    title: appStrings.shortName,
    statusBarStyle: 'default',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#101218' },
  ],
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
