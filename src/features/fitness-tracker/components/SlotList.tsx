'use client';

import type { SlotView } from '../domain/types';
import { SlotRow } from './SlotRow';
import { SortableList } from './SortableList';

type SlotListProps = {
  programId: string;
  workoutId: string;
  slots: readonly SlotView[];
  className?: string | undefined;
  labelledBy: string;
};

export function SlotList({ programId, workoutId, slots, className, labelledBy }: SlotListProps) {
  return (
    <SortableList
      items={slots}
      className={className}
      labelledBy={labelledBy}
      itemName={(slot) => slot.exercise.name}
      moveUrl={(slot) => `/api/fitness/slots/${slot.id}`}
      renderItem={(slot, dragHandle) => (
        <SlotRow programId={programId} workoutId={workoutId} slot={slot} dragHandle={dragHandle} />
      )}
    />
  );
}
