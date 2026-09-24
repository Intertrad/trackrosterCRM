/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contactHref, isLaunchable } from '@/lib/ui/contact-links';

import { ContactActionButton } from './contact-action-button';

afterEach(cleanup);

describe('contactHref', () => {
  it('builds a dialler target a phone app will accept', () => {
    expect(contactHref('call', { phone: '+33 3 29 00 00 00' })).toBe('tel:+33329000000');
    expect(contactHref('email', { email: ' ops@example.test ' })).toBe('mailto:ops@example.test');
  });

  it('refuses to build a target the record cannot support', () => {
    /* A button that opens an empty dialler is worse than no button. */
    expect(contactHref('call', { phone: null })).toBeNull();
    expect(contactHref('call', { phone: '   ' })).toBeNull();
    expect(contactHref('email', { email: null })).toBeNull();
  });

  it('keeps visits inside the product', () => {
    /*
     * Handing a prospect's coordinates to a third-party maps app would send
     * customer location data off the deployment, which is the opposite of why
     * the tiles are self-hosted.
     */
    expect(isLaunchable('visit')).toBe(false);
    expect(contactHref('visit', { phone: '+33 3 29 00 00 00' })).toBeNull();
  });
});

describe('ContactActionButton', () => {
  const base = {
    prospectHref: '/work-queue/c1/p1',
    prospectName: 'Garage Dupont',
    onLogOutcome: vi.fn(),
  };

  it('hands a call to the device dialler', () => {
    render(<ContactActionButton {...base} channel="call" phone="+33 3 29 00 00 00" />);

    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:+33329000000');
  });

  it('asks for the outcome only after the hand-off happened', () => {
    const onLogOutcome = vi.fn();

    render(
      <ContactActionButton
        {...base}
        channel="call"
        phone="+33 3 29 00 00 00"
        onLogOutcome={onLogOutcome}
      />,
    );

    /* A row the prospector never acted on should not be asking to be closed. */
    expect(screen.queryByRole('button', { name: 'Log this call' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Call/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Log this call' }));

    expect(onLogOutcome).toHaveBeenCalledTimes(1);
  });

  it('opens the prospect when there is no number to dial', () => {
    render(<ContactActionButton {...base} channel="call" phone={null} />);

    expect(screen.getByRole('link', { name: 'View prospect' })).toHaveAttribute(
      'href',
      '/work-queue/c1/p1',
    );
  });

  it('opens the prospect for a visit rather than an external map', () => {
    render(<ContactActionButton {...base} channel="visit" phone="+33 3 29 00 00 00" />);

    expect(screen.getByRole('link', { name: 'View prospect' })).toHaveAttribute(
      'href',
      '/work-queue/c1/p1',
    );
  });
});
