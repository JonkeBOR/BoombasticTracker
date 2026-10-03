import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { programFixture } from '@/features/fitness-tracker/components/test-fixtures';
import type { WorkoutView } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import { WorkoutEditScreen } from './WorkoutEditScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const exercises = [
  { id: 'e1', name: 'Incline bench press', isArchived: false },
  { id: 'e2', name: 'Curl', isArchived: false },
];

function fixtureWorkout(): WorkoutView {
  const found = programFixture().workouts[0];
  if (!found) {
    throw new Error('The fixture has no workout');
  }
  return found;
}

describe('WorkoutEditScreen', () => {
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
  });

  function renderScreen(overrides: Partial<Parameters<typeof WorkoutEditScreen>[0]> = {}) {
    return render(
      <WorkoutEditScreen
        programId="p1"
        workout={fixtureWorkout()}
        exercises={exercises}
        {...overrides}
      />,
    );
  }

  function slotList() {
    return screen.getByRole('list', { name: fitnessStrings.workoutEdit.slotsTitle });
  }

  it('shows the workout name, a rename form and a link back to the program', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Upper A' })).toBeDefined();
    expect(
      screen.getByRole('textbox', { name: fitnessStrings.workoutEdit.nameLabel }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: fitnessStrings.navigation.toProgram }).getAttribute('href'),
    ).toBe('/fitness-tracker/programs/p1');
  });

  it('FR-027: lists the slots in order with their sets × reps per block', () => {
    renderScreen();

    const rows = within(slotList()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('Incline bench press')).toBeDefined();
    expect(within(rows[0] as HTMLElement).getByText('3×12 · 3×10 · 2×8')).toBeDefined();
    expect(within(rows[1] as HTMLElement).getByText('1×12 · 1×12 · 1×12')).toBeDefined();
  });

  it('FR-027: each slot links to its edit page', () => {
    renderScreen();

    const link = within(slotList()).getByRole('link', { name: new RegExp('Incline bench press') });
    expect(link.getAttribute('href')).toBe('/fitness-tracker/programs/p1/workouts/w1/slots/s1');
  });

  it('FR-024: marks an optional slot with a tag and a muted style, and no other slot', () => {
    renderScreen();

    const rows = within(slotList()).getAllByRole('listitem');
    expect(within(rows[0] as HTMLElement).queryByText(fitnessStrings.common.optional)).toBeNull();
    expect(within(rows[1] as HTMLElement).getByText(fitnessStrings.common.optional)).toBeDefined();
    const optionalLink = within(rows[1] as HTMLElement).getByRole('link');
    const regularLink = within(rows[0] as HTMLElement).getByRole('link');
    expect(optionalLink.className).toMatch(/optional/);
    expect(regularLink.className).not.toMatch(/optional/);
  });

  it('moves a slot down one position', async () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole('button', {
        name: fitnessStrings.common.moveDownFor('Incline bench press'),
      }),
    );

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/slots/s1');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ toPosition: 2 }));
  });

  it('FR-038: removes a slot only after confirming', async () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole('button', {
        name: fitnessStrings.workoutEdit.removeSlotFor('Curl'),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: fitnessStrings.workoutEdit.removeSlotConfirmLabel }),
    );

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/slots/s2');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('FR-005: explains what to do when the workout has no exercises', () => {
    renderScreen({ workout: { id: 'w2', name: 'Lower A', slots: [] } });

    expect(screen.getByText(fitnessStrings.workoutEdit.noSlots)).toBeDefined();
  });

  it('FR-028: offers the add-exercise form with the active exercises', () => {
    renderScreen();

    const picker = screen.getByLabelText(fitnessStrings.workoutEdit.exerciseLabel);
    expect(picker).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByRole('button', { name: fitnessStrings.workoutEdit.save })).toBeDefined();
  });
});
