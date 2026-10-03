'use client';

import { SortableList } from './SortableList';
import { WorkoutRow } from './WorkoutRow';

type WorkoutListProps = {
  programId: string;
  workouts: readonly { id: string; name: string; removeMessage: string }[];
  className?: string | undefined;
  labelledBy: string;
};

export function WorkoutList({ programId, workouts, className, labelledBy }: WorkoutListProps) {
  return (
    <SortableList
      items={workouts}
      className={className}
      labelledBy={labelledBy}
      itemName={(workout) => workout.name}
      moveUrl={(workout) => `/api/fitness/workouts/${workout.id}`}
      renderItem={(workout, dragHandle) => (
        <WorkoutRow
          programId={programId}
          workout={workout}
          removeMessage={workout.removeMessage}
          dragHandle={dragHandle}
        />
      )}
    />
  );
}
