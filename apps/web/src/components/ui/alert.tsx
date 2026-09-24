import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'critical';

const TONES: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-info-bg border-info-border text-ink',
    icon: <Info className="size-5 shrink-0 text-info" aria-hidden="true" />,
  },
  success: {
    box: 'bg-success-bg border-success-border text-ink',
    icon: <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />,
  },
  warning: {
    box: 'bg-warning-bg border-warning-border text-ink',
    icon: <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />,
  },
  danger: {
    box: 'bg-danger-bg border-danger-border text-ink',
    icon: <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden="true" />,
  },
  critical: {
    box: 'bg-critical-bg border-danger-border text-ink',
    icon: <ShieldAlert className="size-5 shrink-0 text-critical" aria-hidden="true" />,
  },
};

/*
 * Collision, opposition and security alerts must stay visible and cannot
 * be dismissed (design spec §1), so dismissal is an explicit opt-in that
 * the critical tone does not offer.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const isAssertive = tone === 'danger' || tone === 'critical';

  return (
    <div
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-[14px] leading-relaxed',
        TONES[tone].box,
        className,
      )}
    >
      {TONES[tone].icon}

      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}

        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  );
}
