// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageAttachments } from './message-attachments';
import type { Message } from '@/lib/api/messaging-types';

vi.mock('@/lib/i18n/i18n-context', () => ({
  useTranslation: () => ({ language: 'en' }),
}));

const message: Message = {
  id: 'message-1',
  tenantId: 'tenant-1',
  conversationId: 'conversation-1',
  senderId: 'member-1',
  body: 'hey',
  status: 'sent',
  createdAt: '2026-09-29T16:47:00.000Z',
  updatedAt: '2026-09-29T16:47:00.000Z',
};

describe('MessageAttachments', () => {
  it('does not present a plain text message as an attached file', () => {
    render(<MessageAttachments message={message} mine onUpdated={vi.fn()} />);

    expect(screen.queryByText('Attach file')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add an attachment' })).toBeTruthy();
  });

  it('shows the attachment count only when attachments exist', () => {
    render(
      <MessageAttachments
        message={{
          ...message,
          attachments: [
            {
              id: 'attachment-1',
              filename: 'brief.pdf',
              contentType: 'application/pdf',
              byteSize: 1024,
            },
          ],
        }}
        mine
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open message attachments' }).textContent).toContain(
      '1 attachment(s)',
    );
  });
});
