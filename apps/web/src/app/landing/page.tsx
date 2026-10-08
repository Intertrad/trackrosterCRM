import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/landing-page';

export const metadata: Metadata = {
  title: 'Prospecting coordination for multi-company groups',
  description: 'TrackRoster keeps every prospect at the right time, by the right team.',
};

export default function LandingRoute() {
  return <LandingPage />;
}
