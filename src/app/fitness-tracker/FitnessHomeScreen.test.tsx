import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { overviewFixture } from '@/features/fitness-tracker/components/test-fixtures';
import { featureStrings } from '@/lib/strings/features';
import { fitnessStrings } from '@/lib/strings/fitness';
import { FitnessHomeScreen } from './FitnessHomeScreen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

function renderHome(overrides: Partial<Parameters<typeof FitnessHomeScreen>[0]> = {}) {
  return render(
    <FitnessHomeScreen
      isWeighInAvailable
      lastEntryKg={74.5}
      overview={overviewFixture()}
      {...overrides}
    />,
  );
}

function isDisabled(element: HTMLElement): boolean {
  return element instanceof HTMLButtonElement && element.disabled;
}

describe('FitnessHomeScreen', () => {
  it('FR-006: the weigh-in row is the first element of the page content', () => {
    renderHome();

    const first = screen.getByRole('main').firstElementChild;
    expect(first).toBeInstanceOf(HTMLElement);
    if (first instanceof HTMLElement) {
      expect(
        within(first).getByRole('button', { name: fitnessStrings.home.weighIn }),
      ).toBeDefined();
    }
  });

  it('names the tracker and links back to the list of tools', () => {
    renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: fitnessStrings.home.title }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: featureStrings.backToFeatures }).getAttribute('href'),
    ).toBe('/');
  });

  it('US2 scenario 1: shows an enabled Weigh in button next to the last entry', () => {
    renderHome({ isWeighInAvailable: true, lastEntryKg: 74.5 });

    expect(isDisabled(screen.getByRole('button', { name: fitnessStrings.home.weighIn }))).toBe(
      false,
    );
    expect(screen.getByText(fitnessStrings.home.lastEntry('74.5'))).toBeDefined();
  });

  it('US2 scenario 3: disables the button when today already has an entry', () => {
    renderHome({ isWeighInAvailable: false, lastEntryKg: 74.2 });

    expect(isDisabled(screen.getByRole('button', { name: fitnessStrings.home.weighIn }))).toBe(
      true,
    );
    expect(screen.getByText(fitnessStrings.home.lastEntry('74.2'))).toBeDefined();
  });

  it('US2 scenario 4: with no entries the button is enabled and no last entry is shown', () => {
    renderHome({ isWeighInAvailable: true, lastEntryKg: null });

    expect(isDisabled(screen.getByRole('button', { name: fitnessStrings.home.weighIn }))).toBe(
      false,
    );
    expect(screen.queryByText(/Last entry/)).toBeNull();
  });

  it('FR-009: links to Programs and Exercises', () => {
    renderHome();

    expect(
      screen.getByRole('link', { name: fitnessStrings.home.programsLink }).getAttribute('href'),
    ).toBe('/fitness-tracker/programs');
    expect(
      screen.getByRole('link', { name: fitnessStrings.home.exercisesLink }).getAttribute('href'),
    ).toBe('/fitness-tracker/exercises');
  });

  describe('the active program card', () => {
    it('FR-008: shows the program, the current block with its label and the suggested workout', () => {
      renderHome();

      const card = screen.getByRole('link', { name: new RegExp('Strength') });
      expect(card.getAttribute('href')).toBe('/fitness-tracker/active');
      expect(within(card).getByText(fitnessStrings.block.title(2, 'Deload'))).toBeDefined();
      expect(within(card).getByText(new RegExp('Lower A'))).toBeDefined();
    });

    it('leaves out the suggested workout when every workout is finished', () => {
      renderHome({ overview: overviewFixture({ suggestedWorkoutId: null }) });

      const card = screen.getByRole('link', { name: new RegExp('Strength') });
      expect(within(card).queryByText(new RegExp(fitnessStrings.block.suggested))).toBeNull();
    });

    it('FR-008: without an active program it says so and links to Programs', () => {
      renderHome({ overview: null });

      expect(screen.getByText(fitnessStrings.home.noActiveProgram)).toBeDefined();
      expect(
        screen.getByRole('link', { name: fitnessStrings.home.chooseProgram }).getAttribute('href'),
      ).toBe('/fitness-tracker/programs');
    });
  });

  it('opens the weigh-in input from the button', () => {
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.home.weighIn }));

    expect(
      screen.getByRole('textbox', { name: fitnessStrings.home.weighInInputLabel }),
    ).toBeDefined();
  });
});
