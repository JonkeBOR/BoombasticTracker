import type { SetLog } from './types';

export type CycleBlockSummary = {
  cycleNumber: number;
  setLogs: SetLog[];
  sets: number;
  totalReps: number;
  volumeKg: number;
};

export type BlockHistory = {
  trainingBlockId: string;
  blockNumber: number;
  cycles: CycleBlockSummary[];
};

function byPerformedAt(left: SetLog, right: SetLog): number {
  return left.performedAt.getTime() - right.performedAt.getTime();
}

function summarize(cycleNumber: number, setLogs: SetLog[]): CycleBlockSummary {
  return {
    cycleNumber,
    setLogs,
    sets: setLogs.length,
    totalReps: setLogs.reduce((total, log) => total + log.reps, 0),
    volumeKg: setLogs.reduce((total, log) => total + log.reps * (log.weightKg ?? 0), 0),
  };
}

export function groupByBlockAcrossCycles(setLogs: readonly SetLog[]): BlockHistory[] {
  const blocks = new Map<string, { blockNumber: number; byCycle: Map<number, SetLog[]> }>();
  for (const log of [...setLogs].sort(byPerformedAt)) {
    const { trainingBlockId, blockNumber, cycleNumber } = log.context;
    const block = blocks.get(trainingBlockId) ?? {
      blockNumber,
      byCycle: new Map<number, SetLog[]>(),
    };
    const cycleLogs = block.byCycle.get(cycleNumber) ?? [];
    cycleLogs.push(log);
    block.byCycle.set(cycleNumber, cycleLogs);
    blocks.set(trainingBlockId, block);
  }
  return [...blocks.entries()]
    .map(([trainingBlockId, block]) => ({
      trainingBlockId,
      blockNumber: block.blockNumber,
      cycles: [...block.byCycle.entries()]
        .sort(([left], [right]) => left - right)
        .map(([cycleNumber, logs]) => summarize(cycleNumber, logs)),
    }))
    .sort((left, right) => left.blockNumber - right.blockNumber);
}
