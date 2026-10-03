import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { programFixture } from '@/features/fitness-tracker/components/test-fixtures';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { ProgramEditScreen } from './ProgramEditScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('ProgramEditScreen', () => {
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

  type Props = Parameters<typeof ProgramEditScreen>[0];

  function renderScreen(overrides: Partial<Props> = {}) {
    return render(
      <ProgramEditScreen
        program={programFixture()}
        otherActiveProgramName={null}
        inProgressWorkoutIds={[]}
        {...overrides}
      />,
    );
  }

  it('shows the program name as the heading with a rename form, and links back to Programs', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Strength' })).toBeDefined();
    expect(
      screen.getByRole('textbox', { name: fitnessStrings.programEdit.nameLabel }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: fitnessStrings.navigation.toPrograms }).getAttribute('href'),
    ).toBe('/fitness-tracker/programs');
  });

  describe('blocks', () => {
    function blockList() {
      return screen.getByRole('list', { name: fitnessStrings.programEdit.blocksTitle });
    }

    it('FR-026: lists the blocks with an editable label each', () => {
      renderScreen();

      const rows = within(blockList()).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      const second = within(rows[1] as HTMLElement).getByRole('textbox', {
        name: fitnessStrings.programEdit.blockLabelLabel(2),
      });
      expect(second instanceof HTMLInputElement && second.value).toBe('Deload');
    });

    it('saves a changed label when the field is left', async () => {
      renderScreen();

      const input = screen.getByRole('textbox', {
        name: fitnessStrings.programEdit.blockLabelLabel(1),
      });
      fireEvent.change(input, { target: { value: 'Volume' } });
      fireEvent.blur(input);

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/blocks/b1');
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ label: 'Volume' }));
    });

    it('does not save an unchanged label', () => {
      renderScreen();

      const input = screen.getByRole('textbox', {
        name: fitnessStrings.programEdit.blockLabelLabel(2),
      });
      fireEvent.blur(input);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('US3 scenario 7: adds a block at the end', async () => {
      renderScreen();

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programEdit.addBlock }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/programs/p1/blocks');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
    });

    it('FR-026: removes a block after confirming', async () => {
      renderScreen();

      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.programEdit.removeBlockFor(3) }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.programEdit.removeBlockConfirmLabel }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/blocks/b3');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    });

    it('FR-026: offers no removal when only one block is left', () => {
      renderScreen({
        program: programFixture({
          blocks: [{ id: 'b1', number: 1, label: null }],
          cycle: { id: 'c1', currentBlockId: 'b1', pass: 1 },
        }),
      });

      expect(screen.queryByRole('button', { name: new RegExp('Remove block') })).toBeNull();
    });

    it('FR-034: says that removing the current block moves on to the next one', () => {
      renderScreen();

      expect(
        screen.getByText(fitnessStrings.programEdit.removeCurrentBlockMovesOn(2, 3)),
      ).toBeDefined();
      expect(screen.getByText(fitnessStrings.programEdit.removeBlockPlain(1))).toBeDefined();
    });

    it('FR-034, FR-043: says that removing the current last block starts the program again', () => {
      renderScreen({
        program: programFixture({ cycle: { id: 'c1', currentBlockId: 'b3', pass: 1 } }),
      });

      expect(
        screen.getByText(fitnessStrings.programEdit.removeCurrentBlockStartsAgain(3)),
      ).toBeDefined();
    });
  });

  describe('workouts', () => {
    function workoutList() {
      return screen.getByRole('list', { name: fitnessStrings.programEdit.workoutsTitle });
    }

    it('US3 scenario 2: lists the workouts, each linking to its edit page', () => {
      renderScreen();

      const rows = within(workoutList()).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(
        within(rows[0] as HTMLElement)
          .getByRole('link', { name: 'Upper A' })
          .getAttribute('href'),
      ).toBe('/fitness-tracker/programs/p1/workouts/w1');
    });

    it('moves a workout to the position below', async () => {
      renderScreen();

      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.common.moveDownFor('Upper A') }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/workouts/w1');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ toPosition: 2 }));
    });

    it('FR-026: renames a workout from its row', async () => {
      renderScreen();
      const row = within(workoutList()).getAllByRole('listitem')[0] as HTMLElement;

      fireEvent.click(within(row).getByRole('button', { name: fitnessStrings.common.rename }));
      fireEvent.change(within(row).getByRole('textbox'), { target: { value: 'Push' } });
      fireEvent.click(within(row).getByRole('button', { name: fitnessStrings.common.save }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/workouts/w1');
    });

    it('adds a workout by name', async () => {
      renderScreen();

      fireEvent.change(
        screen.getByRole('textbox', { name: fitnessStrings.programEdit.workoutNameLabel }),
        { target: { value: 'Day 3' } },
      );
      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programEdit.addWorkout }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/programs/p1/workouts');
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ name: 'Day 3' }));
    });

    it('FR-005: explains what to do when there are no workouts', () => {
      renderScreen({ program: programFixture({ workouts: [] }) });

      expect(screen.getByText(fitnessStrings.programEdit.noWorkouts)).toBeDefined();
    });

    it('FR-034: says what removal does to the current block of an active program', () => {
      renderScreen();

      expect(
        screen.getAllByText(
          new RegExp(fitnessStrings.programEdit.removeWorkoutMovesOn.slice(0, 20)),
        ).length,
      ).toBeGreaterThan(0);
    });

    it('FR-034: mentions an open workout that will be finished', () => {
      renderScreen({ inProgressWorkoutIds: ['w2'] });

      expect(
        screen.getByText(
          new RegExp(fitnessStrings.programEdit.removeWorkoutInProgress.slice(0, 20)),
        ),
      ).toBeDefined();
    });
  });

  describe('status and activation', () => {
    it('US4 scenario 1: an inactive program offers Activate and no Active badge', () => {
      renderScreen({ program: programFixture({ isActive: false }) });

      expect(
        screen.getByRole('button', { name: fitnessStrings.programEdit.activate }),
      ).toBeDefined();
      expect(screen.queryByText(fitnessStrings.programEdit.active)).toBeNull();
      expect(screen.queryByRole('button', { name: fitnessStrings.programEdit.pause })).toBeNull();
    });

    it('activates straight away when no other program is active', async () => {
      renderScreen({ program: programFixture({ isActive: false }), otherActiveProgramName: null });

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programEdit.activate }));

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/programs/p1/activation');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
    });

    it('FR-038: asks before activating while another program is active, naming it', async () => {
      renderScreen({
        program: programFixture({ isActive: false }),
        otherActiveProgramName: 'Hypertrophy',
      });

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programEdit.activate }));
      expect(
        screen.getByText(fitnessStrings.programEdit.activateWillPause('Hypertrophy')),
      ).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.programEdit.activateConfirmLabel }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/programs/p1/activation');
    });

    it('FR-013: shows program-incomplete inline', async () => {
      fetchMock.mockResolvedValue(Response.json({ error: 'program-incomplete' }, { status: 409 }));
      renderScreen({ program: programFixture({ isActive: false }) });

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programEdit.activate }));

      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe(
          fitnessErrorStrings['program-incomplete'],
        ),
      );
    });

    it('FR-032: an active program shows the badge, Pause and a link to the active program', () => {
      renderScreen({ program: programFixture({ isActive: true }) });

      expect(screen.getByText(fitnessStrings.programEdit.active)).toBeDefined();
      expect(screen.getByRole('button', { name: fitnessStrings.programEdit.pause })).toBeDefined();
      expect(
        screen
          .getByRole('link', { name: fitnessStrings.programEdit.openActiveProgram })
          .getAttribute('href'),
      ).toBe('/fitness-tracker/active');
      expect(
        screen.queryByRole('button', { name: fitnessStrings.programEdit.activate }),
      ).toBeNull();
    });

    it('FR-038: pausing asks first and then refreshes the page', async () => {
      renderScreen({ program: programFixture({ isActive: true }) });

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programEdit.pause }));
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.pauseConfirmLabel }),
      );

      await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/active-program');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    });
  });

  describe('deleting', () => {
    it('FR-033: offers delete for an inactive program, saying logged sets are kept', async () => {
      renderScreen({ program: programFixture({ isActive: false }) });

      expect(screen.getByText(fitnessStrings.programEdit.deleteConfirm)).toBeDefined();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.programEdit.deleteProgram }),
      );
      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.delete }));

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/fitness-tracker/programs'));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/programs/p1');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    });

    it('FR-033: offers no delete while the program is active', () => {
      renderScreen({ program: programFixture({ isActive: true }) });

      expect(
        screen.queryByRole('button', { name: fitnessStrings.programEdit.deleteProgram }),
      ).toBeNull();
    });
  });

  it('FR-032: tells the user that edits apply to future workouts while the program is active', () => {
    renderScreen({ program: programFixture({ isActive: true }) });

    expect(screen.getByText(fitnessStrings.programEdit.futureOnlyNote)).toBeDefined();
  });
});
