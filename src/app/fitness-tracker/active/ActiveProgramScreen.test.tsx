import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overviewFixture } from '@/features/fitness-tracker/components/test-fixtures';
import type { TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ActiveProgramScreen } from './ActiveProgramScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const fourBlocks: TrainingOverview['blocks'] = [
  { id: 'b1', number: 1, label: null, status: 'complete', finishedCount: 2 },
  { id: 'b2', number: 2, label: 'Deload', status: 'current', finishedCount: 1 },
  { id: 'b3', number: 3, label: null, status: 'upcoming', finishedCount: 0 },
  { id: 'b4', number: 4, label: 'Peak', status: 'upcoming', finishedCount: 0 },
];

describe('ActiveProgramScreen', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(Response.json({ newPass: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
    router.push.mockReset();
  });

  function renderScreen(overview: TrainingOverview = overviewFixture({ blocks: fourBlocks })) {
    return render(<ActiveProgramScreen overview={overview} />);
  }

  function blockList() {
    return screen.getByRole('list', { name: fitnessStrings.activeProgram.blocksTitle });
  }

  it('FR-010: shows the program name and no cycle number, dates or past passes', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Strength' })).toBeDefined();
    expect(screen.queryByText(/cycle/i)).toBeNull();
    expect(screen.queryByText(/pass/i)).toBeNull();
  });

  it('FR-011: lists every block in order with its label, progress and status', () => {
    renderScreen();

    const rows = within(blockList()).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    const second = rows[1] as HTMLElement;
    expect(within(second).getByText(fitnessStrings.block.title(2, 'Deload'))).toBeDefined();
    expect(within(second).getByText(fitnessStrings.activeProgram.progress(1, 2))).toBeDefined();
    expect(within(second).getByText(fitnessStrings.activeProgram.status.current)).toBeDefined();
    expect(
      within(rows[0] as HTMLElement).getByText(fitnessStrings.activeProgram.status.complete),
    ).toBeDefined();
    expect(
      within(rows[2] as HTMLElement).getByText(fitnessStrings.activeProgram.status.upcoming),
    ).toBeDefined();
  });

  it('FR-011: shows a skipped block as skipped', () => {
    renderScreen(
      overviewFixture({
        blocks: [
          { id: 'b1', number: 1, label: null, status: 'skipped', finishedCount: 0 },
          { id: 'b2', number: 2, label: null, status: 'current', finishedCount: 0 },
        ],
        currentBlock: { id: 'b2', number: 2, label: null, isLast: true },
      }),
    );

    expect(screen.getByText(fitnessStrings.activeProgram.status.skipped)).toBeDefined();
  });

  it('FR-012: only the current block is a link, and it opens the block view', () => {
    renderScreen();

    const links = within(blockList()).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/fitness-tracker/active/block');
    expect(links[0]?.className).toMatch(/current/);
  });

  it('links to Program edit and back to the fitness tracker', () => {
    renderScreen();

    expect(
      screen
        .getByRole('link', { name: fitnessStrings.activeProgram.editProgram })
        .getAttribute('href'),
    ).toBe('/fitness-tracker/programs/p1');
    expect(
      screen.getByRole('link', { name: fitnessStrings.navigation.toHome }).getAttribute('href'),
    ).toBe('/fitness-tracker');
  });

  describe('skip to block', () => {
    function picker(): HTMLSelectElement {
      const element = screen.getByLabelText(fitnessStrings.activeProgram.skipPickerLabel);
      if (!(element instanceof HTMLSelectElement)) {
        throw new Error('The block picker is not a select');
      }
      return element;
    }

    it('US4 scenario 3, FR-040: offers every later block and block 1 to start again', () => {
      renderScreen();

      expect([...picker().options].map((option) => option.text)).toEqual([
        fitnessStrings.activeProgram.skipChoose,
        fitnessStrings.block.title(3, null),
        fitnessStrings.block.title(4, 'Peak'),
        fitnessStrings.activeProgram.skipStartAgain,
      ]);
    });

    it('edge case: on the last block only block 1 is offered', () => {
      renderScreen(
        overviewFixture({
          blocks: fourBlocks.map((block) =>
            block.number === 4
              ? { ...block, status: 'current' as const }
              : { ...block, status: 'complete' as const },
          ),
          currentBlock: { id: 'b4', number: 4, label: 'Peak', isLast: true },
        }),
      );

      expect([...picker().options].map((option) => option.text)).toEqual([
        fitnessStrings.activeProgram.skipChoose,
        fitnessStrings.activeProgram.skipStartAgain,
      ]);
    });

    it('cannot skip until a block is chosen', () => {
      renderScreen();

      const trigger = screen.getByRole('button', {
        name: fitnessStrings.activeProgram.skipToBlock,
      });
      expect(trigger instanceof HTMLButtonElement && trigger.disabled).toBe(true);
    });

    it('FR-038: a later block asks which blocks are skipped and that logged sets are kept', async () => {
      renderScreen();
      fireEvent.change(picker(), { target: { value: 'b4' } });

      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.skipToBlock }),
      );
      expect(
        screen.getByText(fitnessStrings.activeProgram.skipConfirmLater(4, 2, 3)),
      ).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.skipConfirmLabel }),
      );

      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith('/fitness-tracker/active/block'),
      );
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/active-program/skip');
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ blockId: 'b4' }));
    });

    it('names the one skipped block when only the current block is passed over', () => {
      renderScreen();
      fireEvent.change(picker(), { target: { value: 'b3' } });

      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.skipToBlock }),
      );

      expect(
        screen.getByText(fitnessStrings.activeProgram.skipConfirmLater(3, 2, 2)),
      ).toBeDefined();
    });

    it('FR-038: starting again asks for confirmation too', () => {
      renderScreen();
      fireEvent.change(picker(), { target: { value: 'b1' } });

      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.skipToBlock }),
      );

      expect(screen.getByText(fitnessStrings.activeProgram.skipConfirmStartAgain)).toBeDefined();
    });

    it('US4 scenario 8: mentions the open workout that will be finished', () => {
      renderScreen(
        overviewFixture({
          blocks: fourBlocks,
          workouts: [
            { id: 'w1', name: 'Upper A', status: 'in-progress', sessionId: 's1', finishedAt: null },
          ],
        }),
      );
      fireEvent.change(picker(), { target: { value: 'b3' } });

      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.skipToBlock }),
      );

      expect(
        screen.getByText(new RegExp(fitnessStrings.activeProgram.skipOpenWorkout)),
      ).toBeDefined();
    });
  });

  describe('pause', () => {
    it('US4 scenario 7, FR-038: confirms, pauses and goes home', async () => {
      renderScreen();

      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.activeProgram.pause }));
      expect(screen.getByText(fitnessStrings.activeProgram.pauseConfirm)).toBeDefined();
      fireEvent.click(
        screen.getByRole('button', { name: fitnessStrings.activeProgram.pauseConfirmLabel }),
      );

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/fitness-tracker'));
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/active-program');
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    });
  });
});
