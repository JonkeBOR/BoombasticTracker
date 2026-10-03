import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Program } from '../../domain/types';
import { activateProgram } from '../activation';
import { ensureProfile } from '../profile';
import { createProgram, getProgram } from '../programs';
import { openTestDatabase, type TestDatabase } from '../storage-test-database';
import { createProgramFromSpec, expectOk } from '../storage-test-support';
import { getTrainingOverview } from '../training';
import { handleActivateProgram, handlePause, handleSkip } from './activation';
import { handlerContext, jsonOf } from './handler-test-support';

describe('activation handlers', () => {
  let testDatabase: TestDatabase;
  let profileId: string;
  const now = new Date('2026-10-03T08:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  beforeEach(async () => {
    profileId = (await ensureProfile(testDatabase.db, crypto.randomUUID(), now)).id;
  });

  function context(input: { body?: unknown; params?: Record<string, string> }) {
    return handlerContext({ db: testDatabase.db, profileId, now, ...input });
  }

  async function build(blockCount = 3): Promise<Program> {
    return createProgramFromSpec(
      testDatabase.db,
      profileId,
      {
        blockCount,
        workouts: [{ name: 'Only', slots: [{ exercise: 'Squat', targetReps: [5] }] }],
      },
      now,
    );
  }

  describe('activating', () => {
    it('US4 scenario 1: makes the program active', async () => {
      const program = await build();

      const response = await handleActivateProgram(context({ params: { id: program.id } }));

      expect(response.status).toBe(200);
      expect(await jsonOf(response)).toEqual({});
      expect(expectOk(await getProgram(testDatabase.db, profileId, program.id)).isActive).toBe(
        true,
      );
    });

    it('US4 scenario 2: answers 409 program-incomplete for a program with no workouts', async () => {
      const empty = expectOk(
        await createProgram(testDatabase.db, profileId, { name: 'Empty', blockCount: 2 }, now),
      );

      const response = await handleActivateProgram(context({ params: { id: empty.id } }));

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'program-incomplete' });
      expect(expectOk(await getProgram(testDatabase.db, profileId, empty.id)).isActive).toBe(false);
    });

    it('answers 404 for a program that does not exist', async () => {
      const response = await handleActivateProgram(
        context({ params: { id: crypto.randomUUID() } }),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('pausing', () => {
    it('US4 scenario 7: pauses the active program', async () => {
      const program = await build();
      expectOk(await activateProgram(testDatabase.db, profileId, program.id, now));

      const response = await handlePause(context({}));

      expect(response.status).toBe(200);
      expect(await getTrainingOverview(testDatabase.db, profileId)).toBeNull();
    });

    it('answers 409 no-active-program when nothing is active', async () => {
      const response = await handlePause(context({}));

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'no-active-program' });
    });
  });

  describe('skipping', () => {
    it('US4 scenario 3: skips to a later block and answers that no new pass started', async () => {
      const program = await build();
      expectOk(await activateProgram(testDatabase.db, profileId, program.id, now));

      const response = await handleSkip(context({ body: { blockId: program.blocks[2]?.id } }));

      expect(response.status).toBe(200);
      expect(await jsonOf(response)).toEqual({ newPass: false });
      expect((await getTrainingOverview(testDatabase.db, profileId))?.currentBlock.number).toBe(3);
    });

    it('answers that a new pass started when skipping to the first block', async () => {
      const program = await build();
      expectOk(await activateProgram(testDatabase.db, profileId, program.id, now));

      const response = await handleSkip(context({ body: { blockId: program.blocks[0]?.id } }));

      expect(await jsonOf(response)).toEqual({ newPass: true });
    });

    it('answers 400 invalid-block for the current block', async () => {
      const program = await build();
      expectOk(await activateProgram(testDatabase.db, profileId, program.id, now));
      await handleSkip(context({ body: { blockId: program.blocks[1]?.id } }));

      const response = await handleSkip(context({ body: { blockId: program.blocks[1]?.id } }));

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'invalid-block' });
    });

    it('answers 409 no-active-program when nothing is active', async () => {
      const program = await build();

      const response = await handleSkip(context({ body: { blockId: program.blocks[1]?.id } }));

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'no-active-program' });
    });

    it('answers 400 invalid-body without a block id', async () => {
      const response = await handleSkip(context({ body: {} }));

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'invalid-body' });
    });
  });
});
