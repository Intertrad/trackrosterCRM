import { ArrowUpRight, LockKeyhole, Network, ShieldCheck } from 'lucide-react';

import styles from './page.module.css';

export default function WorkspaceOverviewPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Workspace overview</p>

          <h1>Coordinate prospecting with confidence.</h1>

          <p className={styles.description}>
            TrackRoster keeps assignments, reservations, prospecting activity and follow-ups inside
            one tenant-isolated operational workspace.
          </p>
        </div>

        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeIcon}>
            <ShieldCheck size={20} aria-hidden="true" />
          </span>

          <div>
            <strong>Secure session active</strong>
            <span>Authentication is enforced by the backend.</span>
          </div>
        </div>
      </section>

      <section className={styles.cardGrid} aria-label="Workspace status">
        <article className={styles.statusCard}>
          <span className={styles.cardIcon}>
            <LockKeyhole size={20} aria-hidden="true" />
          </span>

          <div>
            <p className={styles.cardLabel}>Authentication</p>

            <h2>Protected session</h2>

            <p>Access and refresh tokens remain in HttpOnly cookies managed by the web BFF.</p>
          </div>
        </article>

        <article className={styles.statusCard}>
          <span className={styles.cardIcon}>
            <Network size={20} aria-hidden="true" />
          </span>

          <div>
            <p className={styles.cardLabel}>Workspace</p>

            <h2>Tenant scoped</h2>

            <p>Backend services resolve authenticated tenant context before business operations.</p>
          </div>
        </article>

        <article className={styles.statusCard}>
          <span className={styles.cardIcon}>
            <ArrowUpRight size={20} aria-hidden="true" />
          </span>

          <div>
            <p className={styles.cardLabel}>Next phase</p>

            <h2>Role-aware navigation</h2>

            <p>
              Navigation will expand after authenticated access grants are exposed to the frontend.
            </p>
          </div>
        </article>
      </section>

      <section className={styles.workspacePanel}>
        <div>
          <p className={styles.eyebrow}>Application shell</p>

          <h2>Ready for operational workflows</h2>

          <p>
            The authenticated layout is now the shared foundation for the work queue, prospect
            timeline, follow-ups, reporting and administration screens.
          </p>
        </div>

        <span className={styles.foundationBadge}>TR-029</span>
      </section>
    </div>
  );
}
