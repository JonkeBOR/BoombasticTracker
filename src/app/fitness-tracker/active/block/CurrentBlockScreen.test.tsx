import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overviewFixture } from '@/features/fitness-tracker/components/test-fixtures';
import type { TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import { CurrentBlockScreen } from './CurrentBlockScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const threeWorkouts: TrainingOverview['workouts'] = [
  {
    id: 'w1',
    name: 'Upper A',
    status: 'finished',
    sessionId: 's1',
    finishedAt: new Date('2026-10-01T09:00:00Z'),
  },
  { id: 'w2', name: 'Lower A', status: 'in-progress', sessionId: 's2', finishedAt: null },
  { id: 'w3', name: 'Upper B', status: 'not-started', sessionId: null, finishedAt: null },
];

describe('CurrentBlockScreen', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.push.mockReset();
  });

  type Props = Parameters<typeof CurrentBlockScreen>[0];

  function renderScreen(overrides: Partial<Props> = {}) {
    return render(
      <CurrentBlockScreen
        overview={overviewFixture({ workouts: threeWorkouts, suggestedWorkoutId: 'w2' })}
        completedBlock={null}
        startedAgain={false}
        timeZone="UTC"
        {...overrides}
      />,
    );
  }

  function row(name: string): HTMLElement {
    const items = screen.getAllByRole('listitem');
    const found = items.find((item) => item.textContent.includes(name));
    if (!found) {
      throw new Error(`No row for ${name}`);
    }
    return found;
  }

  it('shows the block with its label and links back to the active program', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: fitnessStrings.block.title(2, 'Deload') }),
    ).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: fitnessStrings.navigation.toActiveProgram })
        .getAttribute('href'),
    ).toBe('/fitness-tracker/active');
  });

  it('FR-013: lists the workouts in order with their status', () => {
    renderScreen();

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((item) => item.textContent.slice(0, 7))).toEqual([
      'Upper A',
      'Lower A',
      'Upper B',
    ]);
    expect(
      within(row('Upper A')).getByText(fitnessStrings.block.finishedOn('1 Oct')),
    ).toBeDefined();
    expect(within(row('Lower A')).getByText(fitnessStrings.block.inProgress)).toBeDefined();
    expect(within(row('Upper B')).getByText(fitnessStrings.block.notStarted)).toBeDefined();
  });

  it('FR-013: highlights the suggested workout and no other', () => {
    renderScreen();

    expect(within(row('Lower A')).getByText(fitnessStrings.block.suggested)).toBeDefined();
    expect(within(row('Upper B')).queryByText(fitnessStrings.block.suggested)).toBeNull();
    expect(within(row('Upper A')).queryByText(fitnessStrings.block.suggested)).toBeNull();
  });

  it('FR-014: an in-progress workout resumes through a link to its session', () => {
    renderScreen();

    expect(
      within(row('Lower A'))
        .getByRole('link', { name: new RegExp('Lower A') })
        .getAttribute('href'),
    ).toBe('/fitness-tracker/active/sessions/s2');
  });

  it('FR-014: any not-started workout starts a session and opens it', async () => {
    fetchMock.mockResolvedValue(Response.json({ sessionId: 's9' }));
    renderScreen();

    fireEvent.click(within(row('Upper B')).getByRole('button', { name: new RegExp('Upper B') }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/fitness-tracker/active/sessions/s9'),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/workouts/w3/session');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('FR-023: a finished workout is neither a link nor a button', () => {
    renderScreen();

    expect(within(row('Upper A')).queryByRole('link')).toBeNull();
    expect(within(row('Upper A')).queryByRole('button')).toBeNull();
  });

  it('FR-013: shows a refusal when starting fails', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'workout-already-finished' }, { status: 409 }),
    );
    renderScreen();

    fireEvent.click(within(row('Upper B')).getByRole('button', { name: new RegExp('Upper B') }));

    await waitFor(() => expect(within(row('Upper B')).getByRole('alert')).toBeDefined());
    expect(router.push).not.toHaveBeenCalled();
  });

  describe('the completion notice', () => {
    it('US1 scenario 7: says which block was completed', () => {
      renderScreen({ completedBlock: 1 });

      expect(screen.getByRole('status').textContent).toBe(fitnessStrings.block.blockComplete(1));
    });

    it('US1 scenario 7: says the program starts again after the last block', () => {
      renderScreen({ completedBlock: 4, startedAgain: true });

      expect(screen.getByRole('status').textContent).toBe(fitnessStrings.block.programComplete);
    });

    it('shows no notice when no block was just completed', () => {
      renderScreen();

      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('FR-005: says so when the program has no workouts', () => {
    renderScreen({
      overview: overviewFixture({ workouts: [], workoutCount: 0, suggestedWorkoutId: null }),
    });

    expect(screen.getByText(fitnessStrings.block.noWorkouts)).toBeDefined();
  });
});
