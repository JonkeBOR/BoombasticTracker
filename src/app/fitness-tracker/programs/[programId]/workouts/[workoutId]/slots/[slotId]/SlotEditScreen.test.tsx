import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { programFixture } from '@/features/fitness-tracker/components/test-fixtures';
import type { SlotView } from '@/features/fitness-tracker/domain/types';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { SlotEditScreen } from './SlotEditScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const exercises = [
  { id: 'e1', name: 'Incline bench press', isArchived: false },
  { id: 'e2', name: 'Curl', isArchived: false },
  { id: 'e3', name: 'Machine press', isArchived: false },
];

function fixtureSlot(index: number): SlotView {
  const slot = programFixture().workouts[0]?.slots[index];
  if (!slot) {
    throw new Error('The fixture has no such slot');
  }
  return slot;
}

function withLastWeightOnLastSet(slot: SlotView): SlotView {
  return {
    ...slot,
    prescriptions: slot.prescriptions.map((prescription) => ({
      ...prescription,
      plannedSets: prescription.plannedSets.map((plannedSet, index, all) => ({
        ...plannedSet,
        lastWeightKg: index === all.length - 1 ? 50 : null,
      })),
    })),
  };
}

describe('SlotEditScreen', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const blocks = programFixture().blocks;

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

  function renderScreen(slot: SlotView = fixtureSlot(0)) {
    return render(
      <SlotEditScreen
        programId="p1"
        workoutId="w1"
        slot={slot}
        blocks={blocks}
        exercises={exercises}
      />,
    );
  }

  function section(blockNumber: number, label: string | null = null) {
    return screen.getByRole('region', {
      name: fitnessStrings.slotEdit.blockTitle(blockNumber, label),
    });
  }

  function lastCall() {
    const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: call?.[0], method: call?.[1]?.method, body: call?.[1]?.body };
  }

  it('shows the exercise name and a link back to the workout', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Incline bench press' })).toBeDefined();
    expect(
      screen.getByRole('link', { name: fitnessStrings.navigation.toWorkout }).getAttribute('href'),
    ).toBe('/fitness-tracker/programs/p1/workouts/w1');
  });

  describe('replacing the exercise', () => {
    it('FR-031: confirms that last weights are cleared, then replaces it', async () => {
      renderScreen();
      fireEvent.change(screen.getByLabelText(fitnessStrings.slotEdit.replacementLabel), {
        target: { value: 'e3' },
      });

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.slotEdit.replace }));
      expect(screen.getByText(fitnessStrings.slotEdit.replaceConfirm)).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.slotEdit.replaceConfirmLabel }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1',
        method: 'PATCH',
        body: JSON.stringify({ exerciseId: 'e3' }),
      });
    });

    it('cannot replace until another exercise is chosen, and never offers the current one', () => {
      renderScreen();

      const trigger = screen.getByRole('button', { name: fitnessStrings.slotEdit.replace });
      expect(trigger instanceof HTMLButtonElement && trigger.disabled).toBe(true);
      const picker = screen.getByLabelText(fitnessStrings.slotEdit.replacementLabel);
      expect(picker).toBeInstanceOf(HTMLSelectElement);
      if (picker instanceof HTMLSelectElement) {
        expect([...picker.options].map((option) => option.value)).not.toContain('e1');
      }
    });
  });

  describe('the optional toggle', () => {
    it('US3 scenario 6: marks the slot optional', async () => {
      renderScreen();

      fireEvent.click(
        screen.getByRole('checkbox', { name: fitnessStrings.slotEdit.optionalToggle }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1',
        method: 'PATCH',
        body: JSON.stringify({ isOptional: true }),
      });
    });

    it('shows an optional slot as checked', () => {
      renderScreen(fixtureSlot(1));

      const toggle = screen.getByRole('checkbox', { name: fitnessStrings.slotEdit.optionalToggle });
      expect(toggle instanceof HTMLInputElement && toggle.checked).toBe(true);
    });
  });

  describe('periodization', () => {
    function periodizedToggle(): HTMLInputElement {
      const toggle = screen.getByRole('checkbox', {
        name: fitnessStrings.slotEdit.periodizedToggle,
      });
      if (!(toggle instanceof HTMLInputElement)) {
        throw new Error('The periodized toggle is not an input');
      }
      return toggle;
    }

    function everyBlock() {
      return screen.getByRole('region', { name: fitnessStrings.slotEdit.everyBlockTitle });
    }

    it('shows a periodized slot as checked, with a section per block', () => {
      renderScreen();

      expect(periodizedToggle().checked).toBe(true);
      expect(section(1)).toBeDefined();
      expect(
        screen.queryByRole('region', { name: fitnessStrings.slotEdit.everyBlockTitle }),
      ).toBeNull();
    });

    it('shows a non-periodized slot with one scheme for every block', () => {
      renderScreen(fixtureSlot(1));

      expect(periodizedToggle().checked).toBe(false);
      expect(
        screen.queryByRole('region', { name: fitnessStrings.slotEdit.blockTitle(1, null) }),
      ).toBeNull();
      const scheme = everyBlock();
      const sets = within(scheme).getByLabelText(fitnessStrings.slotEdit.schemeSetsLabel);
      const reps = within(scheme).getByLabelText(fitnessStrings.slotEdit.schemeRepsLabel);
      expect(sets instanceof HTMLInputElement && sets.value).toBe('1');
      expect(reps instanceof HTMLInputElement && reps.value).toBe('12');
      expect(within(scheme).getByText(fitnessStrings.slotEdit.setNumber(1))).toBeDefined();
    });

    it('saves a new sets × reps for every block', async () => {
      renderScreen(fixtureSlot(1));
      const scheme = everyBlock();

      fireEvent.change(within(scheme).getByLabelText(fitnessStrings.slotEdit.schemeSetsLabel), {
        target: { value: '3' },
      });
      fireEvent.click(
        within(scheme).getByRole('button', { name: fitnessStrings.slotEdit.schemeSave }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s2',
        method: 'PATCH',
        body: JSON.stringify({ sets: 3, reps: 12 }),
      });
    });

    it('confirms before a new scheme removes a set that has a last weight', () => {
      renderScreen(withLastWeightOnLastSet({ ...fixtureSlot(0), isPeriodized: false }));
      const scheme = everyBlock();

      fireEvent.change(within(scheme).getByLabelText(fitnessStrings.slotEdit.schemeSetsLabel), {
        target: { value: '2' },
      });
      fireEvent.click(
        within(scheme).getByRole('button', { name: fitnessStrings.slotEdit.schemeSave }),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        within(scheme).getByRole('button', {
          name: fitnessStrings.slotEdit.removeSetsConfirmLabel,
        }),
      ).toBeDefined();
    });

    it('turning it off asks for one sets × reps, prefilled from the first block', async () => {
      renderScreen();

      fireEvent.click(periodizedToggle());
      const sets = screen.getByLabelText(fitnessStrings.slotEdit.schemeSetsLabel);
      const reps = screen.getByLabelText(fitnessStrings.slotEdit.schemeRepsLabel);
      expect(sets instanceof HTMLInputElement && sets.value).toBe('3');
      expect(reps instanceof HTMLInputElement && reps.value).toBe('12');
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.slotEdit.unperiodizeApply }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1',
        method: 'PATCH',
        body: JSON.stringify({ isPeriodized: false, sets: 3, reps: 12 }),
      });
    });

    it('turning it on with no last weights needs no confirmation', async () => {
      const slot = fixtureSlot(1);
      renderScreen({
        ...slot,
        prescriptions: slot.prescriptions.map((prescription) => ({
          ...prescription,
          plannedSets: prescription.plannedSets.map((set) => ({ ...set, lastWeightKg: null })),
        })),
      });

      fireEvent.click(periodizedToggle());

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s2',
        method: 'PATCH',
        body: JSON.stringify({ isPeriodized: true }),
      });
    });

    it('turning it on confirms first that last weights are cleared', async () => {
      renderScreen(withLastWeightOnLastSet(fixtureSlot(1)));

      fireEvent.click(periodizedToggle());
      expect(screen.getByText(fitnessStrings.slotEdit.periodizeConfirm)).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.slotEdit.periodizeApply }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall().body).toBe(JSON.stringify({ isPeriodized: true }));
    });
  });

  describe('the prescription of each block', () => {
    it('FR-029: has one section per block with its number and label', () => {
      renderScreen();

      expect(section(1)).toBeDefined();
      expect(section(2, 'Deload')).toBeDefined();
      expect(section(3)).toBeDefined();
    });

    it('FR-029: shows each set with its target in a numeric input and its last weight, or a dash', () => {
      renderScreen();

      const first = section(1);
      const reps = within(first).getByLabelText(fitnessStrings.slotEdit.targetRepsLabel(1));
      expect(reps instanceof HTMLInputElement && reps.value).toBe('12');
      expect(reps.getAttribute('inputmode')).toBe('numeric');
      expect(within(first).getByText(fitnessStrings.slotEdit.lastWeight('62.5'))).toBeDefined();
      expect(within(first).getAllByText(fitnessStrings.common.noValue)).toHaveLength(2);
    });

    it('changes one target when its field is left, sending every target of the block', async () => {
      renderScreen();

      const reps = within(section(1)).getByLabelText(fitnessStrings.slotEdit.targetRepsLabel(2));
      fireEvent.change(reps, { target: { value: '10' } });
      fireEvent.blur(reps);

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1/prescriptions/b1',
        method: 'PUT',
        body: JSON.stringify({ targetReps: [12, 10, 12] }),
      });
    });

    it('FR-013: refuses a target outside 1 to 999 without a request', () => {
      renderScreen();

      const reps = within(section(1)).getByLabelText(fitnessStrings.slotEdit.targetRepsLabel(1));
      fireEvent.change(reps, { target: { value: '1000' } });
      fireEvent.blur(reps);

      expect(within(section(1)).getByRole('alert').textContent).toBe(
        fitnessErrorStrings['invalid-target'],
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('spec R2: adds a set by repeating the last target', async () => {
      renderScreen();

      fireEvent.click(
        within(section(3)).getByRole('button', { name: fitnessStrings.slotEdit.addSet }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1/prescriptions/b3',
        method: 'PUT',
        body: JSON.stringify({ targetReps: [8, 8, 8] }),
      });
    });

    it('spec R2: removes the last set without confirming when it has no last weight', async () => {
      renderScreen();

      fireEvent.click(
        within(section(1)).getByRole('button', { name: fitnessStrings.slotEdit.removeLastSet }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall().body).toBe(JSON.stringify({ targetReps: [12, 12] }));
    });

    it('FR-015: offers no removal when only one set is left', () => {
      renderScreen({ ...fixtureSlot(1), isPeriodized: true });

      expect(
        within(section(1)).queryByRole('button', { name: fitnessStrings.slotEdit.removeLastSet }),
      ).toBeNull();
    });

    it('FR-030: confirms before removing a last set that has a last weight', async () => {
      renderScreen(withLastWeightOnLastSet(fixtureSlot(0)));

      fireEvent.click(
        within(section(1)).getByRole('button', { name: fitnessStrings.slotEdit.removeLastSet }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        within(section(1)).getByRole('button', {
          name: fitnessStrings.slotEdit.removeSetsConfirmLabel,
        }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    });
  });

  describe('quick fill', () => {
    function quickFill(block: HTMLElement, sets: string, reps: string) {
      fireEvent.change(within(block).getByLabelText(fitnessStrings.slotEdit.quickFillSetsLabel), {
        target: { value: sets },
      });
      fireEvent.change(within(block).getByLabelText(fitnessStrings.slotEdit.quickFillRepsLabel), {
        target: { value: reps },
      });
    }

    it('US3 scenario 4: replaces the block sets with sets × reps in one step', async () => {
      renderScreen();
      const block = section(1);

      quickFill(block, '3', '12');
      fireEvent.click(
        within(block).getByRole('button', { name: fitnessStrings.slotEdit.quickFillApply }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1/prescriptions/b1',
        method: 'PUT',
        body: JSON.stringify({ targetReps: [12, 12, 12] }),
      });
    });

    it('FR-030: needs no confirmation when no set with a last weight would go away', async () => {
      renderScreen();
      const block = section(1);

      quickFill(block, '2', '10');
      fireEvent.click(
        within(block).getByRole('button', { name: fitnessStrings.slotEdit.quickFillApply }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    });

    it('FR-030: confirms first when a set with a last weight would go away', async () => {
      renderScreen(withLastWeightOnLastSet(fixtureSlot(0)));
      const block = section(1);

      quickFill(block, '2', '10');
      expect(
        within(block).getAllByText(fitnessStrings.slotEdit.removeSetsConfirm).length,
      ).toBeGreaterThan(0);
      fireEvent.click(
        within(block).getByRole('button', { name: fitnessStrings.slotEdit.quickFillApply }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        within(block).getByRole('button', { name: fitnessStrings.slotEdit.removeSetsConfirmLabel }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall().body).toBe(JSON.stringify({ targetReps: [10, 10] }));
    });

    it('FR-015: keeps Fill disabled until sets and reps are valid', () => {
      renderScreen();
      const block = section(1);
      const apply = within(block).getByRole('button', {
        name: fitnessStrings.slotEdit.quickFillApply,
      });

      quickFill(block, '0', '12');
      expect(apply instanceof HTMLButtonElement && apply.disabled).toBe(true);
      quickFill(block, '3', '1000');
      expect(apply instanceof HTMLButtonElement && apply.disabled).toBe(true);
      quickFill(block, '3', '12');
      expect(apply instanceof HTMLButtonElement && apply.disabled).toBe(false);
    });
  });

  describe('copy from the previous block', () => {
    it('is not offered on the first block', () => {
      renderScreen();

      expect(
        within(section(1)).queryByRole('button', {
          name: fitnessStrings.slotEdit.copyFromPrevious,
        }),
      ).toBeNull();
    });

    it('spec R1: copies the previous block set count and target reps', async () => {
      renderScreen();

      fireEvent.click(
        within(section(2, 'Deload')).getByRole('button', {
          name: fitnessStrings.slotEdit.copyFromPrevious,
        }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(lastCall()).toEqual({
        url: '/api/fitness/slots/s1/prescriptions/b2',
        method: 'PUT',
        body: JSON.stringify({ targetReps: [12, 12, 12] }),
      });
    });
  });
});
