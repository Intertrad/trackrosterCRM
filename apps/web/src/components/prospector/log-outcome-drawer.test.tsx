/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { OutcomeDefinition } from '@/lib/api/outcome-settings-types';

const { getOutcomeSettingsMock, createActionMock, startActionMock, completeActionMock } =
  vi.hoisted(() => ({
    getOutcomeSettingsMock: vi.fn(),
    createActionMock: vi.fn(),
    startActionMock: vi.fn(),
    completeActionMock: vi.fn(),
  }));

vi.mock('@/lib/api/outcome-settings-client', () => ({
  getOutcomeSettings: getOutcomeSettingsMock,
}));

vi.mock('@/lib/api/action-client', () => ({
  createAction: createActionMock,
  startAction: startActionMock,
  completeAction: completeActionMock,
}));

import { LogOutcomeDrawer } from './log-outcome-drawer';

const campaignId = '11111111-1111-4111-8111-111111111111';
const prospectId = '22222222-2222-4222-8222-222222222222';
const teamId = '33333333-3333-4333-8333-333333333333';

function outcome(over: Partial<OutcomeDefinition> = {}): OutcomeDefinition {
  return {
    code: 'contacted',
    label: 'Contacted',
    behavior: 'contacted',
    enabled: true,
    actionTypes: [],
    ...over,
  };
}

function props(over: Record<string, unknown> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    campaignId,
    prospectId,
    teamId,
    establishmentName: 'Brigade de Bastia',
    reservation: { state: 'owned' as const, reservationId: 'r-1', acquiredAt: 'x', expiresAt: 'y' },
    onCompleted: vi.fn(),
    ...over,
  };
}

describe('recording a result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOutcomeSettingsMock.mockResolvedValue({
      outcomes: [
        outcome({ code: 'joint_au_standard', label: 'Joint au standard', actionTypes: ['call'] }),
        outcome({ code: 'mail_envoye', label: 'Mail envoyé', actionTypes: ['email'] }),
        outcome({ code: 'retire', label: 'Retiré', enabled: false, actionTypes: ['call'] }),
        outcome({ code: 'tout_canal', label: 'Tout canal', actionTypes: [] }),
      ],
      lifecycleStages: ['contact_made'],
    });
    createActionMock.mockResolvedValue({ id: 'action-1' });
    startActionMock.mockResolvedValue({ id: 'action-1' });
    completeActionMock.mockResolvedValue({ id: 'action-1' });
  });

  afterEach(cleanup);

  /*
   * The tenant configures these, renames them and retires them. A fixed frontend
   * list offers outcomes nobody uses and hides the ones they added.
   */
  it("offers the tenant's own outcomes in the tenant's own words", async () => {
    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    /* Applies to every channel, so it belongs to a call too. */
    expect(screen.getByText('Tout canal')).toBeInTheDocument();
    /* Retired: its history survives, but it is never offered again. */
    expect(screen.queryByText('Retiré')).not.toBeInTheDocument();
    /* Belongs to e-mail, and the drawer opened on a call. */
    expect(screen.queryByText('Mail envoyé')).not.toBeInTheDocument();
    /* None of the shipped defaults leaks through once configuration arrives. */
    expect(screen.queryByText('Contacted')).not.toBeInTheDocument();
  });

  it('narrows the outcomes when the channel changes', async () => {
    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Email/i }));

    await waitFor(() => expect(screen.getByText('Mail envoyé')).toBeInTheDocument());

    expect(screen.queryByText('Joint au standard')).not.toBeInTheDocument();
  });

  it('drops a chosen outcome the new channel does not offer', async () => {
    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Joint au standard'));
    fireEvent.click(screen.getByRole('button', { name: /Email/i }));

    await waitFor(() => expect(screen.getByText('Mail envoyé')).toBeInTheDocument());

    /*
     * Submitting now would send an outcome the tenant does not offer for e-mail, so
     * the selection is cleared and the drawer asks again.
     */
    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() => expect(screen.getByText('Please select an outcome')).toBeInTheDocument());

    expect(createActionMock).not.toHaveBeenCalled();
  });

  it('records the configured code the tenant chose', async () => {
    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Joint au standard'));
    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() => expect(completeActionMock).toHaveBeenCalled());

    expect(completeActionMock.mock.calls[0]?.[1]).toMatchObject({
      outcomeCode: 'joint_au_standard',
    });

    /* The tenant's wording reaches the subject too, not the frontend's. */
    expect(createActionMock.mock.calls[0]?.[0]).toMatchObject({
      subject: expect.stringContaining('Joint au standard'),
    });
  });

  /*
   * Failing closed here would mean refusing to record a call the prospector has
   * already made, over a settings read. The defaults stand in and say so.
   */
  it('falls back to the standard outcomes and states that it did', async () => {
    getOutcomeSettingsMock.mockRejectedValue(new Error('settings unavailable'));

    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() =>
      expect(
        screen.getByText(/could not be loaded, so the standard ones are shown/),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText('Contacted')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Contacted'));
    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() => expect(completeActionMock).toHaveBeenCalled());
    expect(completeActionMock.mock.calls[0]?.[1]).toMatchObject({ outcomeCode: 'contacted' });
  });

  it('reuses one idempotency key so a retry cannot log the call twice', async () => {
    completeActionMock.mockRejectedValueOnce(new Error('network'));

    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Joint au standard'));

    const save = screen.getByRole('button', { name: /Complete/i });

    fireEvent.click(save);

    await waitFor(() => expect(completeActionMock).toHaveBeenCalledTimes(1));

    fireEvent.click(save);

    await waitFor(() => expect(completeActionMock).toHaveBeenCalledTimes(2));

    /*
     * A failed request is ambiguous — it may have been applied. Retrying under a
     * fresh key would record the same contact a second time.
     */
    const [firstKey, secondKey] = [
      createActionMock.mock.calls[0]?.[1],
      createActionMock.mock.calls[1]?.[1],
    ];

    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('refuses a double submission while the first is in flight', async () => {
    let release: (() => void) | undefined;

    completeActionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve();
        }),
    );

    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Joint au standard'));

    const save = screen.getByRole('button', { name: /Complete/i });

    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(completeActionMock).toHaveBeenCalledTimes(1));

    release?.();
  });

  it('shows the backend refusal rather than a generic failure', async () => {
    completeActionMock.mockRejectedValue(
      new ApiError({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'reservation lost',
        error: 'Conflict',
      }),
    );

    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Joint au standard'));
    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('explains when the web proxy cannot reach the backend', async () => {
    completeActionMock.mockRejectedValue(
      new ApiError({
        statusCode: 502,
        code: 'UPSTREAM_REQUEST_FAILED',
        message: 'Backend service is unavailable',
        error: 'Bad Gateway',
      }),
    );

    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Joint au standard'));
    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() =>
      expect(screen.getByText(/TrackRoster service is unavailable/)).toBeInTheDocument(),
    );
  });

  it('asks for an outcome before anything is sent', async () => {
    render(<LogOutcomeDrawer {...props()} />);

    await waitFor(() => expect(screen.getByText('Joint au standard')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await waitFor(() => expect(screen.getByText('Please select an outcome')).toBeInTheDocument());

    expect(createActionMock).not.toHaveBeenCalled();
  });
});
