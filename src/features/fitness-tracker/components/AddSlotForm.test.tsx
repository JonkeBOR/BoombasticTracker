import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { AddSlotForm } from './AddSlotForm';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const doneHref = '/fitness-tracker/programs/p1/workouts/w1';

const exercises = [
  { id: 'e1', name: 'Incline bench press', isArchived: false },
  { id: 'e2', name: 'Curl', isArchived: false },
];

describe('AddSlotForm', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
    router.replace.mockReset();
  });

  function select(): HTMLSelectElement {
    const element = screen.getByLabelText(fitnessStrings.workoutEdit.exerciseLabel);
    if (!(element instanceof HTMLSelectElement)) {
      throw new Error('The exercise picker is not a select');
    }
    return element;
  }

  function input(label: string): HTMLInputElement {
    const element = screen.getByLabelText(label);
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`${label} is not an input`);
    }
    return element;
  }

  function save(): HTMLButtonElement {
    const element = screen.getByRole('button', { name: fitnessStrings.workoutEdit.save });
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('Save is not a button');
    }
    return element;
  }

  function fillSetsAndReps(sets: string, reps: string) {
    fireEvent.change(input(fitnessStrings.workoutEdit.setsLabel), { target: { value: sets } });
    fireEvent.change(input(fitnessStrings.workoutEdit.repsLabel), { target: { value: reps } });
  }

  it('FR-037: offers the exercises it is given and a new one, with nothing chosen yet', () => {
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    expect([...select().options].map((option) => option.text)).toEqual([
      fitnessStrings.workoutEdit.choose,
      'Incline bench press',
      'Curl',
      fitnessStrings.workoutEdit.newExerciseOption,
    ]);
    expect(select().value).toBe('');
    expect(save().disabled).toBe(true);
  });

  it('FR-010: gives sets and reps a numeric keypad', () => {
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    expect(input(fitnessStrings.workoutEdit.setsLabel).getAttribute('inputmode')).toBe('numeric');
    expect(input(fitnessStrings.workoutEdit.repsLabel).getAttribute('inputmode')).toBe('numeric');
  });

  it('FR-028: keeps Save disabled until an exercise, sets and reps are all given', () => {
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    fireEvent.change(select(), { target: { value: 'e1' } });
    expect(save().disabled).toBe(true);

    fillSetsAndReps('3', '');
    expect(save().disabled).toBe(true);

    fillSetsAndReps('3', '10');
    expect(save().disabled).toBe(false);
  });

  it.each([
    ['0', '10'],
    ['3', '0'],
    ['3', '1000'],
    ['2.5', '10'],
    ['x', '10'],
  ])('FR-015: keeps Save disabled for %s sets of %s reps', (sets, reps) => {
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    fireEvent.change(select(), { target: { value: 'e1' } });
    fillSetsAndReps(sets, reps);

    expect(save().disabled).toBe(true);
  });

  it('US3 scenario 3: creates the slot from the chosen exercise, sets and reps, then goes back', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 's9' }));
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    fireEvent.change(select(), { target: { value: 'e1' } });
    fillSetsAndReps('3', '10');
    fireEvent.click(save());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(doneHref));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/workouts/w1/slots');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ exerciseId: 'e1', sets: 3, reps: 10 }),
    );
  });

  it('US3 scenario 3: creates a new exercise first, then the slot with its id', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: 'e9', name: 'Seal rows', isArchived: false }),
    );
    fetchMock.mockResolvedValueOnce(Response.json({ id: 's9' }));
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    fireEvent.change(select(), { target: { value: '__new__' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(input(fitnessStrings.workoutEdit.newExerciseNameLabel), {
      target: { value: 'Seal rows' },
    });
    fillSetsAndReps('4', '8');
    fireEvent.click(save());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/exercises');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ name: 'Seal rows' }));
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/fitness/workouts/w1/slots');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ exerciseId: 'e9', sets: 4, reps: 8 }),
    );
  });

  it('edge case: opens on the new-exercise choice when there are no exercises yet', () => {
    render(<AddSlotForm workoutId="w1" exercises={[]} doneHref={doneHref} />);

    expect(select().value).toBe('__new__');
    expect(input(fitnessStrings.workoutEdit.newExerciseNameLabel)).toBeDefined();
  });

  it('keeps the created exercise chosen when the slot is refused, so only the slot needs fixing', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: 'e9', name: 'Seal rows', isArchived: false }),
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'prescription-needs-a-set' }, { status: 400 }),
    );
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    fireEvent.change(select(), { target: { value: '__new__' } });
    fireEvent.change(input(fitnessStrings.workoutEdit.newExerciseNameLabel), {
      target: { value: 'Seal rows' },
    });
    fillSetsAndReps('4', '8');
    fireEvent.click(save());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        fitnessErrorStrings['prescription-needs-a-set'],
      ),
    );
    expect(select().value).toBe('e9');
    expect([...select().options].map((option) => option.text)).toContain('Seal rows');
  });

  it('FR-013: shows a refused exercise name inline without creating a slot', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'name-taken' }, { status: 409 }));
    render(<AddSlotForm workoutId="w1" exercises={exercises} doneHref={doneHref} />);

    fireEvent.change(select(), { target: { value: '__new__' } });
    fireEvent.change(input(fitnessStrings.workoutEdit.newExerciseNameLabel), {
      target: { value: 'Curl' },
    });
    fillSetsAndReps('3', '10');
    fireEvent.click(save());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['name-taken']),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
