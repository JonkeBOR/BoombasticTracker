import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@/features/fitness-tracker/domain/types';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { ExercisesScreen } from './ExercisesScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const exercises: Exercise[] = [
  { id: 'e1', name: 'Squat', isArchived: false },
  { id: 'e2', name: 'chins', isArchived: false },
  { id: 'e3', name: 'Dips', isArchived: false },
  { id: 'e4', name: 'Old press', isArchived: true },
];

describe('ExercisesScreen', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
  });

  function names(): string[] {
    return screen
      .queryAllByRole('listitem')
      .map((item) => item.textContent.replace(fitnessStrings.common.archived, '').trim());
  }

  function filterBox(): HTMLInputElement {
    const element = screen.getByRole('textbox', { name: fitnessStrings.exercises.filterLabel });
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('The filter is not an input');
    }
    return element;
  }

  it('shows the title and links back to the fitness tracker', () => {
    render(<ExercisesScreen exercises={exercises} />);

    expect(
      screen.getByRole('heading', { level: 1, name: fitnessStrings.exercises.title }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: fitnessStrings.navigation.toHome }).getAttribute('href'),
    ).toBe('/fitness-tracker');
  });

  it('FR-035: lists the active exercises alphabetically, ignoring case', () => {
    render(<ExercisesScreen exercises={exercises} />);

    expect(names()).toEqual(['chins', 'Dips', 'Squat']);
  });

  it('FR-035: each exercise links to its edit page', () => {
    render(<ExercisesScreen exercises={exercises} />);

    expect(screen.getByRole('link', { name: 'Dips' }).getAttribute('href')).toBe(
      '/fitness-tracker/exercises/e3',
    );
  });

  it('FR-035: filters by name, ignoring case', () => {
    render(<ExercisesScreen exercises={exercises} />);

    fireEvent.change(filterBox(), { target: { value: 'IP' } });

    expect(names()).toEqual(['Dips']);
  });

  it('says so when the filter matches nothing', () => {
    render(<ExercisesScreen exercises={exercises} />);

    fireEvent.change(filterBox(), { target: { value: 'zzz' } });

    expect(screen.getByText(fitnessStrings.exercises.noMatches)).toBeDefined();
  });

  it('US5 scenario 4: hides archived exercises until asked, then marks them', () => {
    render(<ExercisesScreen exercises={exercises} />);
    expect(screen.queryByText(/Old press/)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: fitnessStrings.exercises.showArchived }));

    expect(names()).toEqual(['chins', 'Dips', 'Old press', 'Squat']);
    const archived = screen.getByRole('link', { name: new RegExp('Old press') });
    expect(within(archived).getByText(fitnessStrings.common.archived)).toBeDefined();
  });

  it('FR-005: explains what to do when there are no exercises, and still offers the form', () => {
    render(<ExercisesScreen exercises={[]} />);

    expect(screen.getByText(fitnessStrings.exercises.empty)).toBeDefined();
    expect(screen.getByRole('button', { name: fitnessStrings.exercises.add })).toBeDefined();
  });

  describe('adding an exercise', () => {
    function add(name: string) {
      fireEvent.change(screen.getByRole('textbox', { name: fitnessStrings.exercises.nameLabel }), {
        target: { value: name },
      });
      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.exercises.add }));
    }

    it('US5 scenario 1: sends the name and refreshes the list', async () => {
      fetchMock.mockResolvedValue(
        Response.json({ id: 'e9', name: 'Seal rows', isArchived: false }),
      );
      render(<ExercisesScreen exercises={exercises} />);

      add('Seal rows');

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/exercises');
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ name: 'Seal rows' }));
    });

    it('US5 scenario 2: shows a taken name inline', async () => {
      fetchMock.mockResolvedValue(Response.json({ error: 'name-taken' }, { status: 409 }));
      render(<ExercisesScreen exercises={exercises} />);

      add('Chins');

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['name-taken']),
      );
      expect(router.refresh).not.toHaveBeenCalled();
    });
  });
});
