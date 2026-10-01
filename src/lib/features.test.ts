import { expect, test } from 'vitest';
import { featureStrings } from '@/lib/strings/features';
import { features } from './features';

test('the fitness tracker is the only feature', () => {
  expect(features).toEqual([
    {
      id: 'fitness-tracker',
      path: '/fitness-tracker',
      title: featureStrings.fitnessTracker.title,
      description: featureStrings.fitnessTracker.description,
    },
  ]);
});

test('feature ids are unique and paths are local routes', () => {
  expect(new Set(features.map((feature) => feature.id)).size).toBe(features.length);
  for (const feature of features) {
    expect(feature.path).toMatch(/^\/[a-z0-9-]+$/);
  }
});
