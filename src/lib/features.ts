import { featureStrings } from '@/lib/strings/features';

export type Feature = {
  id: string;
  path: string;
  title: string;
  description: string;
};

export const features: readonly Feature[] = [
  {
    id: 'fitness-tracker',
    path: '/fitness-tracker',
    title: featureStrings.fitnessTracker.title,
    description: featureStrings.fitnessTracker.description,
  },
];
