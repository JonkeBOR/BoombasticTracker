import type { SetLog } from './types';

export type PassBlockSummary = {
  pass: number;
  setLogs: SetLog[];
  sets: number;
  totalReps: number;
  volumeKg: number;
};

export type BlockHistory = {
  trainingBlockId: string;
  blockNumber: number;
  passes: PassBlockSummary[];
};

function byPerformedAt(left: SetLog, right: SetLog): number {
  return left.performedAt.getTime() - right.performedAt.getTime();
}

function summarize(pass: number, setLogs: SetLog[]): PassBlockSummary {
  return {
    pass,
    setLogs,
    sets: setLogs.length,
    totalReps: setLogs.reduce((total, log) => total + log.reps, 0),
    volumeKg: setLogs.reduce((total, log) => total + log.reps * (log.weightKg ?? 0), 0),
  };
}

export function groupByBlockAcrossPasses(setLogs: readonly SetLog[]): BlockHistory[] {
  const blocks = new Map<string, { blockNumber: number; byPass: Map<number, SetLog[]> }>();
  for (const log of [...setLogs].sort(byPerformedAt)) {
    const { trainingBlockId, blockNumber, pass } = log.context;
    const block = blocks.get(trainingBlockId) ?? {
      blockNumber,
      byPass: new Map<number, SetLog[]>(),
    };
    const passLogs = block.byPass.get(pass) ?? [];
    passLogs.push(log);
    block.byPass.set(pass, passLogs);
    blocks.set(trainingBlockId, block);
  }
  return [...blocks.entries()]
    .map(([trainingBlockId, block]) => ({
      trainingBlockId,
      blockNumber: block.blockNumber,
      passes: [...block.byPass.entries()]
        .sort(([left], [right]) => left - right)
        .map(([pass, logs]) => summarize(pass, logs)),
    }))
    .sort((left, right) => left.blockNumber - right.blockNumber);
}
