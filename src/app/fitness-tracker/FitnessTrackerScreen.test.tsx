import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { featureStrings } from '@/lib/strings/features';
import { FitnessTrackerScreen } from './FitnessTrackerScreen';

test('names the fitness tracker and says tracking is coming', () => {
  render(<FitnessTrackerScreen />);

  expect(
    screen.getByRole('heading', { level: 1, name: featureStrings.fitnessTracker.title }),
  ).toBeDefined();
  expect(screen.getByText(featureStrings.fitnessTracker.placeholder)).toBeDefined();
});

test('links back to the list of tools', () => {
  render(<FitnessTrackerScreen />);

  expect(
    screen.getByRole('link', { name: featureStrings.backToFeatures }).getAttribute('href'),
  ).toBe('/');
});
