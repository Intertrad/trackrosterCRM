import { ArrowRight, CheckCircle2, CircleDashed, ShieldCheck } from 'lucide-react';

const foundations = [
  {
    title: 'Design foundation',
    description: 'TrackRoster colors, typography, semantic states, and responsive layout.',
    status: 'Ready',
    complete: true,
  },
  {
    title: 'Authentication',
    description: 'Connect the application shell to the existing NestJS authentication API.',
    status: 'Next',
    complete: false,
  },
  {
    title: 'Prospect Work Queue',
    description: 'Build the tenant-safe operational queue for prospectors after authentication.',
    status: 'TR-030',
    complete: false,
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-primary">TrackRoster</p>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Workspace overview
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            The frontend foundation for secure, coordinated prospecting workflows.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-success/20 bg-success-background px-3 py-1.5 text-xs font-semibold text-success">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Backend foundation available
        </div>
      </section>

      <section aria-label="Frontend status" className="grid gap-4 md:grid-cols-3">
        {foundations.map((item) => (
          <article
            key={item.title}
            className="rounded-[14px] border border-border bg-surface p-5 shadow-(--shadow-card)"
          >
            <div className="flex items-start justify-between gap-4">
              <div
                className={[
                  'flex size-10 items-center justify-center rounded-lg',
                  item.complete
                    ? 'bg-success-background text-success'
                    : 'bg-info-background text-info',
                ].join(' ')}
              >
                {item.complete ? (
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                ) : (
                  <CircleDashed aria-hidden="true" className="size-5" />
                )}
              </div>

              <span
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  item.complete
                    ? 'bg-success-background text-success'
                    : 'bg-surface-secondary text-text-secondary',
                ].join(' ')}
              >
                {item.status}
              </span>
            </div>

            <h2 className="mt-5 text-base font-semibold text-foreground">{item.title}</h2>

            <p className="mt-2 text-sm leading-6 text-text-secondary">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-(--shadow-card)">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-foreground">Next delivery milestone</h2>

          <p className="mt-1 text-sm text-text-secondary">
            Build the security boundary before exposing operational workflows.
          </p>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-info-background px-2 py-1 text-xs font-semibold text-info">
                FOUNDATION
              </span>

              <span className="text-sm text-text-muted">Frontend authentication</span>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-foreground">
              Connect the shell to TrackRoster authentication
            </h3>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              Login, HttpOnly session cookies, session restoration, backend access grants, protected
              routing, and workspace derivation come before the Prospect Work Queue.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
            Next step
            <ArrowRight aria-hidden="true" className="size-4" />
          </div>
        </div>
      </section>
    </div>
  );
}
