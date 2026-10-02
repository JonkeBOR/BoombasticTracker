export type Profile = { id: string };

export type Exercise = { id: string; name: string; isArchived: boolean };

export type CycleStatus = 'active' | 'completed' | 'ended_early';

export type SessionStatus = 'in_progress' | 'finished';

export type Cycle = {
  id: string;
  number: number;
  status: CycleStatus;
  currentBlockNumber: number;
  startedAt: Date;
  endedAt: Date | null;
};

export type PlannedSetView = {
  id: string;
  setNumber: number;
  targetReps: number;
  lastWeightKg: number | null;
};

export type Prescription = { blockId: string; plannedSets: PlannedSetView[] };

export type SlotView = {
  id: string;
  exercise: Exercise;
  isOptional: boolean;
  prescriptions: Prescription[];
};

export type WorkoutView = { id: string; name: string; slots: SlotView[] };

export type BlockView = { id: string; number: number; label: string | null };

export type Program = {
  id: string;
  name: string;
  isActive: boolean;
  blocks: BlockView[];
  workouts: WorkoutView[];
  activeCycle: Cycle | null;
};

export type ProgramSummary = { id: string; name: string; isActive: boolean };

export type SetLogContext = {
  programId: string;
  cycleId: string;
  cycleNumber: number;
  trainingBlockId: string;
  blockNumber: number;
  workoutId: string;
  exerciseSlotId: string;
  workoutSessionId: string;
};

export type SetLog = {
  id: string;
  exerciseId: string;
  performedAt: Date;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  context: SetLogContext;
};

export type BodyweightEntry = { id: string; date: string; weightKg: number };

export type SessionPlannedSet = {
  id: string;
  setNumber: number;
  targetReps: number;
  suggestedWeightKg: number | null;
};

export type SessionSlot = {
  id: string;
  exercise: Exercise;
  isOptional: boolean;
  plannedSets: SessionPlannedSet[];
  loggedSets: SetLog[];
};

export type SessionView = {
  id: string;
  status: SessionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  workout: { id: string; name: string };
  cycleNumber: number;
  blockNumber: number;
  slots: SessionSlot[];
};

export type WorkoutProgress = 'not-started' | 'in-progress' | 'finished';

export type TrainingOverview = {
  program: { id: string; name: string };
  cycle: Cycle;
  block: { number: number; label: string | null; count: number };
  workouts: { id: string; name: string; status: WorkoutProgress }[];
  suggestedWorkoutId: string | null;
};
