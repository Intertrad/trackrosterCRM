import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './marketing.css';
import { RuntimePreferences } from '@/components/account/runtime-preferences';
import { AuthProvider } from '@/lib/auth/auth-context';
import { SessionLanguage } from '@/lib/i18n/session-language';

/*
 * The dossier specifies Inter Display for titles and key figures and
 * Inter for interface text. The bundled OFL Inter variable font
 * covers both roles, so display treatment is expressed
 * through weight and tracking rather than a second download.
 */
const inter = localFont({
  src: './fonts/Inter-Latin.woff2',
  weight: '100 900',
  variable: '--font-inter',
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
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SessionLanguage>
            <RuntimePreferences />
            {children}
          </SessionLanguage>
        </AuthProvider>
      </body>
    </html>
  );
}
