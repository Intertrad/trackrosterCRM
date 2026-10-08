import type { Metadata } from 'next';

import { LandingPage } from '@/components/marketing/landing-page';

export const metadata: Metadata = {
  title: 'Coordination de prospection pour les groupes multi-entreprises',
  description: 'TrackRoster garde chaque prospect au bon moment, avec la bonne équipe.',
};

export default function LandingRoute() {
  return <LandingPage />;
}
