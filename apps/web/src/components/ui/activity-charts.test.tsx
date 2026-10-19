/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ActivityCharts,
  activityTotals,
  activitySegments,
  activityColor,
  type ActivityRow,
} from './activity-charts';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api/browser-json', () => ({ browserJson: get }));
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ activeWorkspace: { teamId: 'team', organizationId: 'org' } }),
}));
vi.mock('@/lib/live/use-live-refresh', () => ({ useLiveRefresh: () => {} }));
afterEach(cleanup);
const rows: ActivityRow[] = [
  { date: '2026-10-15', channel: 'call', status: 'completed', outcome: 'contacted', count: 2 },
  { date: '2026-10-15', channel: 'call', status: 'overdue', outcome: null, count: 1 },
  { date: '2026-10-15', channel: 'call', status: 'cancelled', outcome: null, count: 1 },
];
describe('activity charts', () => {
  it('groups completed channels before red statuses in mission order', () => {
    const sample: ActivityRow[] = ['message', 'call', 'visit', 'email'].flatMap((channel) => [
      { date: '2026-10-15', channel, status: 'cancelled' as const, outcome: null, count: 1 },
      { date: '2026-10-15', channel, status: 'completed' as const, outcome: null, count: 1 },
      { date: '2026-10-15', channel, status: 'overdue' as const, outcome: null, count: 1 },
    ]);
    const segments = activitySegments(sample);
    expect(segments.slice(0, 4).map((row) => row.channel)).toEqual([
      'visit',
      'call',
      'email',
      'message',
    ]);
    expect(segments.slice(0, 4).every((row) => row.status === 'completed')).toBe(true);
    expect(segments.slice(4).map((row) => row.channel)).toEqual([
      'visit',
      'visit',
      'call',
      'call',
      'email',
      'email',
      'message',
      'message',
    ]);
    expect(activityColor('visit', 'overdue')).toBe('#7f1d1d');
    expect(activityColor('visit', 'cancelled')).toBe(activityColor('visit', 'overdue'));
    expect(activityColor('visit', 'completed')).toBe('#1544a7');
  });
  it('keeps completed and total missions distinct', () => {
    expect(activityTotals(rows)).toEqual({ completed: 2, total: 4 });
  });
  it('shows completed/total with overdue and cancelled details for a channel', async () => {
    get.mockResolvedValue({
      items: rows,
      generatedAt: '2026-10-15',
      range: { from: '2026-10-01', to: '2026-10-16' },
      timeZone: 'Europe/Paris',
    });
    render(<ActivityCharts mode="channels" days="30" />);
    const sector = await screen.findByLabelText('Calls · Completed : 2 / 4');
    expect(screen.getByText('2 / 4')).toBeVisible();
    fireEvent.mouseEnter(sector);
    expect(screen.getByRole('status')).toHaveTextContent('Overdue : 1');
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled : 1');
    expect(String(get.mock.calls.at(-1)?.[0])).toContain('teamId=team');
    expect(String(get.mock.calls.at(-1)?.[0])).toContain('organizationId=org');
  });
  it('refetches the selected period and presents an empty state', async () => {
    get.mockClear();
    get.mockResolvedValue({
      items: [],
      range: { from: '2026-10-01', to: '2026-10-16' },
      timeZone: 'Europe/Paris',
    });
    render(<ActivityCharts mode="channels" />);
    await screen.findByText('No missions in this period.');
    fireEvent.change(screen.getByLabelText('Activity period'), { target: { value: '90' } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const url = new URL(String(get.mock.calls[1]?.[0]), 'http://localhost');
    expect(
      (Date.parse(url.searchParams.get('to')!) - Date.parse(url.searchParams.get('from')!)) /
        86400000,
    ).toBe(90);
  });
});
