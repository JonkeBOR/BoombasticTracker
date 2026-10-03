'use client';

import { useState } from 'react';
import { useFitnessAction } from './useFitnessAction';

export type Reordering = { ids: string[]; toPosition: number };

export function reorder(
  ids: readonly string[],
  activeId: string,
  overId: string | null,
): Reordering | null {
  if (overId === null || activeId === overId) {
    return null;
  }
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0) {
    return null;
  }
  const remaining = ids.filter((id) => id !== activeId);
  remaining.splice(to, 0, activeId);
  return { ids: remaining, toPosition: to + 1 };
}

export function useReorder<Item extends { id: string }>(
  items: readonly Item[],
  moveUrl: (item: Item) => string,
) {
  const action = useFitnessAction();
  const serverIds = items.map((item) => item.id);
  const serverKey = serverIds.join(' ');
  const [local, setLocal] = useState({ serverKey, ids: serverIds });

  let ids = local.ids;
  if (local.serverKey !== serverKey) {
    setLocal({ serverKey, ids: serverIds });
    ids = serverIds;
  }

  const ordered = ids.flatMap((id) => items.filter((item) => item.id === id));

  async function move(activeId: string, overId: string | null) {
    const reordering = reorder(ids, activeId, overId);
    const item = items.find((candidate) => candidate.id === activeId);
    if (!reordering || !item) {
      return;
    }
    setLocal({ serverKey, ids: reordering.ids });
    const succeeded = await action.run('PATCH', moveUrl(item), {
      toPosition: reordering.toPosition,
    });
    if (!succeeded) {
      setLocal({ serverKey, ids: serverIds });
    }
  }

  return {
    items: ordered,
    move,
    pending: action.pending,
    errorMessage: action.errorMessage,
  };
}
