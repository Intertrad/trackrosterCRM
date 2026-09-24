'use client';

import { FilterSelect } from '@/components/ui/filter-select';

export type ManagerPeriod = 'this_week' | 'last_week' | 'this_month' | 'last_30_days';

const PERIOD_OPTIONS = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
];

/*
 * The backend takes an explicit half-open range (from <= t < to), so the
 * period pill is resolved to timestamps here rather than sent as a label the
 * API would have to interpret.
 */
export function resolvePeriod(period: ManagerPeriod): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  switch (period) {
    case 'this_week': {
      const day = (now.getDay() + 6) % 7;
      from.setDate(now.getDate() - day);
      break;
    }

    case 'last_week': {
      const day = (now.getDay() + 6) % 7;
      to.setDate(now.getDate() - day);
      from.setDate(now.getDate() - day - 7);
      break;
    }

    case 'this_month':
      from.setDate(1);
      break;

    case 'last_30_days':
      from.setDate(now.getDate() - 30);
      break;
  }

  from.setHours(0, 0, 0, 0);

  return { from: from.toISOString(), to: to.toISOString() };
}

export function PeriodFilter({
  value,
  onChange,
}: {
  value: ManagerPeriod;
  onChange: (next: ManagerPeriod) => void;
}) {
  return (
    <FilterSelect
      label="Period"
      value={value}
      onChange={(next) => onChange(next as ManagerPeriod)}
      options={PERIOD_OPTIONS}
    />
  );
}
