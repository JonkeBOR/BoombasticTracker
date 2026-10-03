import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseUsage } from '@/features/fitness-tracker/domain/types';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { ExerciseEditScreen } from './ExerciseEditScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

function usage(overrides: Partial<ExerciseUsage> = {}): ExerciseUsage {
  return {
    exercise: { id: 'e1', name: 'Press', isArchived: false },
    slots: [
      { programId: 'p1', programName: 'Strength', workoutId: 'w1', workoutName: 'Upper A' },
      { programId: 'p2', programName: 'Cut', workoutId: 'w9', workoutName: 'Full body' },
    ],
    hasSetLogs: true,
    ...overrides,
  };
}

const unused = { slots: [], hasSetLogs: false };

describe('ExerciseEditScreen', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(Response.json({}));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
    router.push.mockReset();
  });

  it('shows the exercise name and links back to Exercises', () => {
    render(<ExerciseEditScreen usage={usage()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Press' })).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: fitnessStrings.navigation.toExercises })
        .getAttribute('href'),
    ).toBe('/fitness-tracker/exercises');
  });

  it('FR-036: renames the exercise and shows a taken name inline', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'name-taken' }, { status: 409 }));
    render(<ExerciseEditScreen usage={usage()} />);

    fireEvent.change(screen.getByRole('textbox', { name: fitnessStrings.exerciseEdit.nameLabel }), {
      target: { value: 'Chins' },
    });
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.rename }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['name-taken']),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/exercises/e1');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ name: 'Chins' }));
  });

  describe('used in', () => {
    it('US5 scenario 5: lists each workout with its program, linking to Workout edit', () => {
      render(<ExerciseEditScreen usage={usage()} />);

      const list = screen.getByRole('list', { name: fitnessStrings.exerciseEdit.usedIn });
      const links = within(list).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        fitnessStrings.exerciseEdit.usedItem('Strength', 'Upper A'),
        fitnessStrings.exerciseEdit.usedItem('Cut', 'Full body'),
      ]);
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/fitness-tracker/programs/p1/workouts/w1',
        '/fitness-tracker/programs/p2/workouts/w9',
      ]);
    });

    it('says so when no workout uses the exercise', () => {
      render(<ExerciseEditScreen usage={usage(unused)} />);

      expect(screen.getByText(fitnessStrings.exerciseEdit.notUsed)).toBeDefined();
    });
  });

  describe('archiving', () => {
    it('US5 scenario 4: archives an active exercise', async () => {
      render(<ExerciseEditScreen usage={usage()} />);

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.exerciseEdit.archive }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/exercises/e1');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ isArchived: true }));
    });

    it('unarchives an archived exercise', async () => {
      render(
        <ExerciseEditScreen
          usage={usage({ exercise: { id: 'e1', name: 'Press', isArchived: true } })}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.exerciseEdit.unarchive }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ isArchived: false }));
      expect(
        screen.queryByRole('button', { name: fitnessStrings.exerciseEdit.archive }),
      ).toBeNull();
    });
  });

  describe('deleting', () => {
    it('US5 scenario 3, FR-036: is not offered once the exercise has set logs', () => {
      render(<ExerciseEditScreen usage={usage({ slots: [], hasSetLogs: true })} />);

      expect(screen.queryByRole('button', { name: fitnessStrings.exerciseEdit.delete })).toBeNull();
    });

    it('FR-036: is not offered while a workout uses the exercise', () => {
      render(<ExerciseEditScreen usage={usage({ hasSetLogs: false })} />);

      expect(screen.queryByRole('button', { name: fitnessStrings.exerciseEdit.delete })).toBeNull();
    });

    it('FR-038: asks first, then deletes and returns to the list', async () => {
      render(<ExerciseEditScreen usage={usage(unused)} />);

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.exerciseEdit.delete }));
      expect(screen.getByText(fitnessStrings.exerciseEdit.deleteConfirm)).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.exerciseEdit.deleteConfirmLabel }),
      );

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/fitness-tracker/exercises'));
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    });
  });
});
