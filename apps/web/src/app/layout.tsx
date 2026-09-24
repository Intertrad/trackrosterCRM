import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { SessionLanguage } from '@/lib/i18n/session-language';

/*
 * The dossier specifies Inter Display for titles and key figures and
 * Inter for interface text. Google serves one variable Inter family
 * that covers both optical roles, so display treatment is expressed
 * through weight and tracking rather than a second download.
 */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TrackRoster',
    template: '%s | TrackRoster',
  },

  description: 'Coordinate prospecting activity, assignments and follow-ups across teams.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#05124a',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SessionLanguage>{children}</SessionLanguage>
        </AuthProvider>
      </body>
    </html>
  );
}
