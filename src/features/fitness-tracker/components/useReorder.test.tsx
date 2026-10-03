import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessErrorStrings } from '@/lib/strings/fitness';
import { reorder, useReorder } from './useReorder';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('reorder', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves an item down to the position of the item it is dropped on', () => {
    expect(reorder(ids, 'a', 'c')).toEqual({ ids: ['b', 'c', 'a', 'd'], toPosition: 3 });
  });

  it('moves an item up to the position of the item it is dropped on', () => {
    expect(reorder(ids, 'd', 'b')).toEqual({ ids: ['a', 'd', 'b', 'c'], toPosition: 2 });
  });

  it.each([
    ['dropped on itself', 'b', 'b'],
    ['dropped outside the list', 'b', null],
    ['dropped on an unknown item', 'b', 'x'],
  ])('does nothing when %s', (_case, activeId, overId) => {
    expect(reorder(ids, activeId, overId)).toBeNull();
  });
});

describe('useReorder', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const items = [
    { id: 'w1', name: 'Upper A' },
    { id: 'w2', name: 'Lower A' },
    { id: 'w3', name: 'Upper B' },
  ];
  const moveUrl = (item: { id: string }) => `/api/fitness/workouts/${item.id}`;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
  });

  function names(result: { current: { items: readonly { name: string }[] } }) {
    return result.current.items.map((item) => item.name);
  }

  it('shows the new order at once and sends the 1-based target position', async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    const { result } = renderHook(() => useReorder(items, moveUrl));

    act(() => {
      void result.current.move('w1', 'w3');
    });

    expect(names(result)).toEqual(['Lower A', 'Upper B', 'Upper A']);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/workouts/w1');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ toPosition: 3 }));
  });

  it('puts the order back and shows the refusal when the move fails', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'not-found' }, { status: 404 }));
    const { result } = renderHook(() => useReorder(items, moveUrl));

    await act(() => result.current.move('w1', 'w2'));

    expect(names(result)).toEqual(['Upper A', 'Lower A', 'Upper B']);
    expect(result.current.errorMessage).toBe(fitnessErrorStrings['not-found']);
  });

  it('sends nothing when the item is dropped where it was', async () => {
    const { result } = renderHook(() => useReorder(items, moveUrl));

    await act(() => result.current.move('w2', 'w2'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(names(result)).toEqual(['Upper A', 'Lower A', 'Upper B']);
  });

  it('follows the server order when the items change', () => {
    const { result, rerender } = renderHook(({ list }) => useReorder(list, moveUrl), {
      initialProps: { list: items },
    });

    rerender({ list: [items[2], items[0], items[1]].filter((item) => item !== undefined) });

    expect(names(result)).toEqual(['Upper B', 'Upper A', 'Lower A']);
  });
});
