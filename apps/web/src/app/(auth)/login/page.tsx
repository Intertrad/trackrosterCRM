import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

function TrackRosterMark() {
  return (
    <div aria-hidden="true" className="grid size-10 grid-cols-3 gap-0.75 rounded-lg bg-navy p-1.75">
      <span className="rounded-xs bg-white" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-lime" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
      <span className="rounded-xs bg-white/55" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(520px,0.72fr)]">
      <section className="hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 grid-cols-3 gap-0.75 rounded-lg bg-white/10 p-1.75">
            <span className="rounded-xs bg-white" />
            <span className="rounded-xs bg-white/55" />
            <span className="rounded-xs bg-white/55" />
            <span className="rounded-xs bg-white/55" />
            <span className="rounded-xs bg-lime" />
            <span className="rounded-xs bg-white/55" />
            <span className="rounded-xs bg-white/55" />
            <span className="rounded-xs bg-white/55" />
            <span className="rounded-xs bg-white/55" />
          </div>

          <div>
            <p className="text-lg font-semibold">TrackRoster</p>
            <p className="text-xs text-white/50">Prospecting coordination</p>
          </div>
        </div>

        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/75">
            <ShieldCheck aria-hidden="true" className="size-4 text-lime" />
            Secure team coordination
          </span>

          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Keep every prospect action coordinated.
          </h1>

          <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
            Manage prospect ownership, follow-ups, collision prevention, and team activity from one
            operational workspace.
          </p>
        </div>

        <p className="text-xs text-white/35">TrackRoster</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-105">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <TrackRosterMark />

            <div>
              <p className="font-semibold text-foreground">TrackRoster</p>
              <p className="text-xs text-text-muted">Prospecting coordination</p>
            </div>
          </div>

          <p className="text-sm font-semibold text-primary">Welcome back</p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Sign in to TrackRoster
          </h2>

          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Enter your organization credentials to continue to your workspace.
          </p>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
