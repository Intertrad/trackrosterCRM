import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { Alert } from '@/components/ui/alert';
export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Accédez à votre espace de prospection TrackRoster.',
};
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { reset } = await searchParams;
  return (
    <AuthShell language="fr">
      {reset === 'success' && (
        <Alert tone="success" className="mb-6" title="Mot de passe modifié">
          Connectez-vous avec votre nouveau mot de passe.
        </Alert>
      )}
      <header className="mb-7">
        <h2 className="text-[32px] font-bold tracking-tight text-navy">Connexion</h2>
        <p className="mt-1 text-base text-ink-muted">
          Saisissez votre email professionnel — votre rôle est chargé avec votre compte.
        </p>
      </header>
      <LoginForm language="fr" />
      <p className="mt-8 text-center text-xs text-ink-muted">
        <Link href="/invite" className="hover:text-brand">
          Vous avez reçu une invitation ? Activer mon accès
        </Link>
      </p>
    </AuthShell>
  );
}
