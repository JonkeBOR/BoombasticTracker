import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SortableList } from './SortableList';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const items = [
  { id: 'w1', name: 'Upper A' },
  { id: 'w2', name: 'Lower A' },
];

function List() {
  return (
    <SortableList
      items={items}
      labelledBy="workouts-heading"
      itemName={(item) => item.name}
      moveUrl={(item) => `/api/fitness/workouts/${item.id}`}
      renderItem={(item, dragHandle) => (
        <span>
          {item.name}
          {dragHandle}
        </span>
      )}
    />
  );
}

describe('SortableList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('hydrates the server-rendered list without a mismatch', () => {
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = renderToString(<List />);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recoverableErrors: unknown[] = [];

    act(() => {
      hydrateRoot(container, <List />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
