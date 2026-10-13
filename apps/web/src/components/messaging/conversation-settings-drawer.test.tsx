// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationSettingsDrawer } from './conversation-settings-drawer';
import type { Conversation } from '@/lib/api/messaging-types';
vi.mock('@/lib/i18n/i18n-context', () => ({ useTranslation: () => ({ language: 'en' }) }));
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));
afterEach(cleanup);
const conversation = { id: 'one', title: 'Original', status: 'active' } as Conversation;
const props = { open: true, conversation, onClose: vi.fn(), onUpdated: vi.fn() };
describe('conversation rename draft', () => {
  it('keeps typed text through repeated inbox refreshes', () => {
    const { rerender } = render(<ConversationSettingsDrawer {...props} />);
    fireEvent.change(screen.getByLabelText('Conversation title'), {
      target: { value: 'My unfinished title' },
    });
    for (let i = 0; i < 3; i++)
      rerender(<ConversationSettingsDrawer {...props} conversation={{ ...conversation }} />);
    expect((screen.getByLabelText('Conversation title') as HTMLInputElement).value).toBe(
      'My unfinished title',
    );
  });
  it('loads the current title when reopened or switched to another conversation', () => {
    const { rerender } = render(<ConversationSettingsDrawer {...props} />);
    fireEvent.change(screen.getByLabelText('Conversation title'), { target: { value: 'Unsaved' } });
    rerender(<ConversationSettingsDrawer {...props} open={false} />);
    rerender(
      <ConversationSettingsDrawer
        {...props}
        conversation={{ ...conversation, title: 'Saved elsewhere' }}
      />,
    );
    expect((screen.getByLabelText('Conversation title') as HTMLInputElement).value).toBe(
      'Saved elsewhere',
    );
    rerender(
      <ConversationSettingsDrawer
        {...props}
        conversation={{ ...conversation, id: 'two', title: 'Second' }}
      />,
    );
    expect((screen.getByLabelText('Conversation title') as HTMLInputElement).value).toBe('Second');
  });
});
