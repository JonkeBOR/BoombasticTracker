'use client';

import { useCallback, useState } from 'react';
import type { SetLog } from '../domain/types';

export type LoggedValues = Pick<SetLog, 'reps' | 'weightKg'>;

export type SetLogging = {
  optimistic: Readonly<Record<string, LoggedValues>>;
  inFlight: boolean;
  begin: (plannedSetId: string, values: LoggedValues) => void;
  settle: (plannedSetId: string, succeeded: boolean) => void;
};

export function useSetLogging(): SetLogging {
  const [optimistic, setOptimistic] = useState<Readonly<Record<string, LoggedValues>>>({});
  const [inFlightCount, setInFlightCount] = useState(0);

  const begin = useCallback((plannedSetId: string, values: LoggedValues) => {
    setOptimistic((current) => ({ ...current, [plannedSetId]: values }));
    setInFlightCount((count) => count + 1);
  }, []);

  const settle = useCallback((plannedSetId: string, succeeded: boolean) => {
    setInFlightCount((count) => count - 1);
    if (!succeeded) {
      setOptimistic((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== plannedSetId)),
      );
    }
  }, []);

  return { optimistic, inFlight: inFlightCount > 0, begin, settle };
}
