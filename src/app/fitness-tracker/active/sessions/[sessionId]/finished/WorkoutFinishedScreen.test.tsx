import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overviewFixture } from '@/features/fitness-tracker/components/test-fixtures';
import type { TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import { WorkoutFinishedScreen } from './WorkoutFinishedScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const workouts: TrainingOverview['workouts'] = [
  {
    id: 'w1',
    name: 'Upper A',
    status: 'finished',
    sessionId: 's1',
    finishedAt: new Date('2026-10-01T09:00:00Z'),
  },
  { id: 'w2', name: 'Lower A', status: 'not-started', sessionId: null, finishedAt: null },
];

describe('WorkoutFinishedScreen', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.push.mockReset();
  });

  type Props = Parameters<typeof WorkoutFinishedScreen>[0];

  function renderScreen(overrides: Partial<Props> = {}) {
    return render(
      <WorkoutFinishedScreen
        affirmation="Strong work!"
        workoutName="Upper A"
        overview={overviewFixture({ workouts, suggestedWorkoutId: 'w2' })}
        completedBlock={null}
        startedAgain={false}
        timeZone="UTC"
        {...overrides}
      />,
    );
  }

  it('congratulates on the finished workout', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Strong work!' })).toBeDefined();
    expect(screen.getByText(fitnessStrings.finished.summary('Upper A'))).toBeDefined();
  });

  it('starts the next workout and opens it', async () => {
    fetchMock.mockResolvedValue(Response.json({ sessionId: 's9' }));
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: new RegExp('Lower A') }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/fitness-tracker/active/sessions/s9'),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/workouts/w2/session');
  });

  it('links to the current block', () => {
    renderScreen();

    expect(
      screen
        .getByRole('link', {
          name: fitnessStrings.finished.toBlock(fitnessStrings.block.title(2, 'Deload')),
        })
        .getAttribute('href'),
    ).toBe('/fitness-tracker/active/block');
  });

  it('offers no next workout when none is suggested', () => {
    renderScreen({ overview: overviewFixture({ workouts, suggestedWorkoutId: null }) });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says which block was completed', () => {
    renderScreen({ completedBlock: 1 });

    expect(screen.getByRole('status').textContent).toBe(fitnessStrings.block.blockComplete(1));
  });

  it('says the program starts again after the last block', () => {
    renderScreen({ completedBlock: 4, startedAgain: true });

    expect(screen.getByRole('status').textContent).toBe(fitnessStrings.block.programComplete);
  });

  it('shows no notice when no block was just completed', () => {
    renderScreen();

    expect(screen.queryByRole('status')).toBeNull();
  });
});
