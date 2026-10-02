import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import { decideLogSet, prefill } from '../domain/logging';
import { fail, type Result, succeed } from '../domain/result';
import { decideAfterFinish } from '../domain/progression';
import { decideStartWorkout, suggestedNextWorkout, workoutStatuses } from '../domain/session';
import type { SessionView, SetLog, TrainingOverview } from '../domain/types';
import { isUniqueConstraintViolation, runBatch, type Statement } from './batch';
import { endCycleStatements, startCycleStatement } from './cycle-statements';
import { type BlockRow, type CycleRow, toCycle, toExercise, toSetLog } from './mapping';
import {
  cycles,
  exerciseSlots,
  plannedSets,
  profiles,
  programs,
  setLogs,
  trainingBlocks,
  workoutSessions,
  workouts,
} from './schema';

type ActiveContext = {
  programId: string;
  programName: string;
  cycle: CycleRow;
  blocks: BlockRow[];
  workouts: { id: string; name: string }[];
};

async function loadActiveContext(db: Database, profileId: string): Promise<ActiveContext | null> {
  const [profile] = await db
    .select({ activeProgramId: profiles.activeProgramId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const programId = profile?.activeProgramId ?? null;
  if (programId === null) {
    return null;
  }
  const [program] = await db
    .select({ name: programs.name })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.profileId, profileId)))
    .limit(1);
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.programId, programId), eq(cycles.status, 'active')))
    .limit(1);
  if (!program || !cycle) {
    return null;
  }
  const [blocks, workoutRows] = await Promise.all([
    db
      .select()
      .from(trainingBlocks)
      .where(eq(trainingBlocks.programId, programId))
      .orderBy(asc(trainingBlocks.position)),
    db
      .select({ id: workouts.id, name: workouts.name })
      .from(workouts)
      .where(eq(workouts.programId, programId))
      .orderBy(asc(workouts.position)),
  ]);
  return { programId, programName: program.name, cycle, blocks, workouts: workoutRows };
}

function sessionsOfCurrentBlock(db: Database, context: ActiveContext) {
  return db
    .select({
      id: workoutSessions.id,
      workoutId: workoutSessions.workoutId,
      status: workoutSessions.status,
    })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.cycleId, context.cycle.id),
        eq(workoutSessions.blockNumber, context.cycle.currentBlockNumber),
      ),
    );
}

export async function getTrainingOverview(
  db: Database,
  profileId: string,
): Promise<TrainingOverview | null> {
  const context = await loadActiveContext(db, profileId);
  if (!context) {
    return null;
  }
  const sessions = await sessionsOfCurrentBlock(db, context);
  const workoutIds = context.workouts.map((workout) => workout.id);
  const nameById = new Map(context.workouts.map((workout) => [workout.id, workout.name]));
  const currentBlock = context.blocks.find(
    (block) => block.position === context.cycle.currentBlockNumber,
  );
  return {
    program: { id: context.programId, name: context.programName },
    cycle: toCycle(context.cycle),
    block: {
      number: context.cycle.currentBlockNumber,
      label: currentBlock?.label ?? null,
      count: context.blocks.length,
    },
    workouts: workoutStatuses(workoutIds, sessions).map((entry) => ({
      id: entry.workoutId,
      name: nameById.get(entry.workoutId) ?? '',
      status: entry.status,
    })),
    suggestedWorkoutId: suggestedNextWorkout(workoutIds, sessions),
  };
}

export async function getSession(
  db: Database,
  profileId: string,
  sessionId: string,
): Promise<Result<SessionView, 'not-found'>> {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.profileId, profileId)))
    .limit(1);
  if (!session) {
    return fail('not-found');
  }
  const [workout] = await db
    .select({ id: workouts.id, name: workouts.name })
    .from(workouts)
    .where(eq(workouts.id, session.workoutId))
    .limit(1);
  if (!workout) {
    return fail('not-found');
  }
  const [block] = await db
    .select({ id: trainingBlocks.id })
    .from(trainingBlocks)
    .where(
      and(
        eq(trainingBlocks.programId, session.programId),
        eq(trainingBlocks.position, session.blockNumber),
      ),
    )
    .limit(1);
  const [slotRows, logRows] = await Promise.all([
    db.query.exerciseSlots.findMany({
      where: eq(exerciseSlots.workoutId, workout.id),
      orderBy: asc(exerciseSlots.position),
      with: {
        exercise: true,
        plannedSets: { where: eq(plannedSets.trainingBlockId, block?.id ?? '') },
      },
    }),
    db
      .select()
      .from(setLogs)
      .where(eq(setLogs.workoutSessionId, session.id))
      .orderBy(asc(setLogs.performedAt), sql`rowid`),
  ]);
  const logs = logRows.map(toSetLog);
  return succeed({
    id: session.id,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    workout,
    cycleNumber: session.cycleNumber,
    blockNumber: session.blockNumber,
    slots: slotRows.map((slot) => ({
      id: slot.id,
      exercise: toExercise(slot.exercise),
      isOptional: slot.isOptional,
      plannedSets: prefill(slot.plannedSets),
      loggedSets: logs.filter((log) => log.context.exerciseSlotId === slot.id),
    })),
  });
}

export async function startWorkout(
  db: Database,
  profileId: string,
  workoutId: string,
  now: Date,
): Promise<
  Result<
    SessionView,
    'no-active-program' | 'workout-not-in-active-program' | 'workout-already-finished'
  >
> {
  const context = await loadActiveContext(db, profileId);
  if (!context) {
    return fail('no-active-program');
  }
  const findExisting = async () => {
    const [existing] = await db
      .select({ id: workoutSessions.id, status: workoutSessions.status })
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.cycleId, context.cycle.id),
          eq(workoutSessions.blockNumber, context.cycle.currentBlockNumber),
          eq(workoutSessions.workoutId, workoutId),
        ),
      )
      .limit(1);
    return existing ?? null;
  };
  const decision = decideStartWorkout({
    workoutId,
    programWorkoutIds: context.workouts.map((workout) => workout.id),
    existingSession: await findExisting(),
  });
  if (!decision.ok) {
    return fail(decision.error);
  }
  let sessionId = decision.value.kind === 'resume' ? decision.value.sessionId : null;
  if (sessionId === null) {
    const newSessionId = crypto.randomUUID();
    try {
      await db.insert(workoutSessions).values({
        id: newSessionId,
        profileId,
        programId: context.programId,
        cycleId: context.cycle.id,
        workoutId,
        cycleNumber: context.cycle.number,
        blockNumber: context.cycle.currentBlockNumber,
        status: 'in_progress',
        startedAt: now,
        finishedAt: null,
      });
      sessionId = newSessionId;
    } catch (error) {
      const existing = isUniqueConstraintViolation(error) ? await findExisting() : null;
      if (!existing) {
        throw error;
      }
      sessionId = existing.id;
    }
  }
  const session = await getSession(db, profileId, sessionId);
  if (!session.ok) {
    throw new Error('The session was not found after it was started');
  }
  return succeed(session.value);
}

export async function logSet(
  db: Database,
  profileId: string,
  sessionId: string,
  plannedSetId: string,
  input: { reps: number; weightKg?: number | null },
  now: Date,
): Promise<
  Result<
    SetLog,
    | 'not-found'
    | 'session-not-in-progress'
    | 'planned-set-not-in-session'
    | 'invalid-reps'
    | 'invalid-weight'
  >
> {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.profileId, profileId)))
    .limit(1);
  const [target] = await db
    .select({
      setNumber: plannedSets.setNumber,
      slotId: exerciseSlots.id,
      slotWorkoutId: exerciseSlots.workoutId,
      exerciseId: exerciseSlots.exerciseId,
      blockId: trainingBlocks.id,
      blockNumber: trainingBlocks.position,
    })
    .from(plannedSets)
    .innerJoin(exerciseSlots, eq(exerciseSlots.id, plannedSets.exerciseSlotId))
    .innerJoin(workouts, eq(workouts.id, exerciseSlots.workoutId))
    .innerJoin(programs, eq(programs.id, workouts.programId))
    .innerJoin(trainingBlocks, eq(trainingBlocks.id, plannedSets.trainingBlockId))
    .where(and(eq(plannedSets.id, plannedSetId), eq(programs.profileId, profileId)))
    .limit(1);
  if (!session || !target) {
    return fail('not-found');
  }
  const decision = decideLogSet({
    session: {
      status: session.status,
      workoutId: session.workoutId,
      blockNumber: session.blockNumber,
    },
    plannedSet: { slotWorkoutId: target.slotWorkoutId, blockNumber: target.blockNumber },
    input,
  });
  if (!decision.ok) {
    return fail(decision.error);
  }
  const row = {
    id: crypto.randomUUID(),
    profileId,
    exerciseId: target.exerciseId,
    performedAt: now,
    setNumber: target.setNumber,
    reps: decision.value.reps,
    weightGrams: decision.value.weightGrams,
    programId: session.programId,
    cycleId: session.cycleId,
    trainingBlockId: target.blockId,
    workoutId: session.workoutId,
    exerciseSlotId: target.slotId,
    workoutSessionId: session.id,
    cycleNumber: session.cycleNumber,
    blockNumber: session.blockNumber,
  };
  await runBatch(db, [
    db.insert(setLogs).values(row),
    db
      .update(plannedSets)
      .set({ lastWeightGrams: decision.value.newLastWeightGrams })
      .where(eq(plannedSets.id, plannedSetId)),
  ]);
  return succeed(toSetLog(row));
}

export async function finishWorkout(
  db: Database,
  profileId: string,
  sessionId: string,
  now: Date,
): Promise<
  Result<
    { progression: 'none' | 'block-advanced' | 'cycle-completed' },
    'not-found' | 'session-not-in-progress'
  >
> {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.profileId, profileId)))
    .limit(1);
  if (!session) {
    return fail('not-found');
  }
  if (session.status !== 'in_progress') {
    return fail('session-not-in-progress');
  }
  const statements: Statement[] = [
    db
      .update(workoutSessions)
      .set({ status: 'finished', finishedAt: now })
      .where(eq(workoutSessions.id, sessionId)),
  ];
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, session.cycleId)).limit(1);
  let progression: 'none' | 'block-advanced' | 'cycle-completed' = 'none';
  if (cycle && cycle.status === 'active' && cycle.currentBlockNumber === session.blockNumber) {
    const [workoutRows, finishedRows, blockRows] = await Promise.all([
      db.select({ id: workouts.id }).from(workouts).where(eq(workouts.programId, cycle.programId)),
      db
        .select({ workoutId: workoutSessions.workoutId })
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.cycleId, cycle.id),
            eq(workoutSessions.blockNumber, cycle.currentBlockNumber),
            eq(workoutSessions.status, 'finished'),
          ),
        ),
      db
        .select({ id: trainingBlocks.id })
        .from(trainingBlocks)
        .where(eq(trainingBlocks.programId, cycle.programId)),
    ]);
    const decision = decideAfterFinish({
      cycle,
      blockCount: blockRows.length,
      workoutIds: workoutRows.map((workout) => workout.id),
      finishedWorkoutIdsInBlock: [...finishedRows.map((row) => row.workoutId), session.workoutId],
    });
    if (decision.kind === 'advance') {
      progression = 'block-advanced';
      statements.push(
        db
          .update(cycles)
          .set({ currentBlockNumber: decision.toBlockNumber })
          .where(eq(cycles.id, cycle.id)),
      );
    } else if (decision.kind === 'complete') {
      progression = 'cycle-completed';
      statements.push(
        ...endCycleStatements(db, { id: cycle.id, status: 'completed' }, now),
        startCycleStatement(
          db,
          { programId: cycle.programId, number: decision.newCycleNumber },
          now,
        ),
      );
    }
  }
  await runBatch(db, statements);
  return succeed({ progression });
}
