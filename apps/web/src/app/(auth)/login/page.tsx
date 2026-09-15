import type { Metadata } from 'next';
import { Check, ShieldCheck } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';

import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your TrackRoster workspace.',
};

const decorativeTiles = Array.from({ length: 9 }, (_, index) => index);

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.brand}>
            <TrackRosterMark />

            <span>TrackRoster</span>
          </div>

          <p className={styles.tagline}>
            Every prospect, at the
            <br />
            right time, by the right
            <br />
            team.
          </p>
        </div>

        <div className={styles.securityArea}>
          <div className={styles.divider} />

          <div className={styles.security}>
            <ShieldCheck size={28} strokeWidth={1.9} />

            <div>
              <strong>Secure &amp; protected</strong>

              <span>HttpOnly session</span>
              <span>Backend-enforced access</span>
            </div>
          </div>
        </div>
      </aside>

      <section className={styles.mainContent}>
        <div className={styles.content}>
          <header className={styles.heading}>
            <h1>Login</h1>

            <p>
              Sign in with your work credentials. Your role and workspace will be loaded
              automatically after login.
            </p>
          </header>

          <LoginForm />

          <p className={styles.accessText}>
            Need access? <span>Contact your administrator.</span>
          </p>
        </div>

        <div className={styles.decoration} aria-hidden="true">
          {decorativeTiles.map((tile) => (
            <div key={tile} className={`${styles.tile} ${tile === 5 ? styles.checkedTile : ''}`}>
              {tile === 5 ? <Check size={58} strokeWidth={1.5} /> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function TrackRosterMark() {
  return (
    <div className={styles.logoMark} aria-hidden="true">
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className={index === 5 ? styles.logoChecked : index >= 6 ? styles.logoBlue : ''}
        >
          {index === 5 ? <Check size={13} strokeWidth={3} /> : null}
        </span>
      ))}
    </div>
  );
}
