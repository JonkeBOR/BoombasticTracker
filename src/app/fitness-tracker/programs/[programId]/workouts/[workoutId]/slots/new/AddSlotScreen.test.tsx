import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fitnessStrings } from '@/lib/strings/fitness';
import { AddSlotScreen } from './AddSlotScreen';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('AddSlotScreen', () => {
  it('FR-028: shows the add-exercise form under its own title, with a way back to the workout', () => {
    render(
      <AddSlotScreen
        programId="p1"
        workoutId="w1"
        exercises={[{ id: 'e1', name: 'Curl', isArchived: false }]}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: fitnessStrings.workoutEdit.addExercise }),
    ).toBeDefined();
    expect(screen.getByLabelText(fitnessStrings.workoutEdit.exerciseLabel)).toBeDefined();
    expect(
      screen.getByRole('link', { name: fitnessStrings.navigation.toWorkout }).getAttribute('href'),
    ).toBe('/fitness-tracker/programs/p1/workouts/w1');
  });
});
