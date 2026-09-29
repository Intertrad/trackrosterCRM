import { describe, expect, it } from 'vitest';
import { togglePage, toggleRecord } from './record-selection';
describe('bounded explicit selection', () => {
  it('retains previous pages, caps a batch and permits deselection at the limit', () => {
    const first = [{ id: 'a' }, { id: 'b' }],
      next = [{ id: 'c' }, { id: 'd' }];
    let selected = togglePage(new Map(), first, 3);
    selected = togglePage(selected, next, 3);
    expect([...selected.keys()]).toEqual(['a', 'b', 'c']);
    selected = toggleRecord(selected, { id: 'a' }, 3);
    expect([...selected.keys()]).toEqual(['b', 'c']);
    expect([...toggleRecord(selected, { id: 'd' }, 3).keys()]).toEqual(['b', 'c', 'd']);
  });
  it('deselects only the visible page and never mutates the prior selection', () => {
    const selected = new Map([
      ['a', { id: 'a' }],
      ['b', { id: 'b' }],
    ]);
    expect([...togglePage(selected, [{ id: 'b' }], 100).keys()]).toEqual(['a']);
    expect(selected.size).toBe(2);
  });
});
