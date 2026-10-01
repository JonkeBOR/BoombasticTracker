import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { Feature } from '@/lib/features';
import { appStrings } from '@/lib/strings/app';
import { authStrings } from '@/lib/strings/auth';
import { featureStrings } from '@/lib/strings/features';
import { LandingScreen } from './LandingScreen';

const sampleFeatures: readonly Feature[] = [
  { id: 'first', path: '/first', title: 'First tool', description: 'Does the first thing.' },
  { id: 'second', path: '/second', title: 'Second tool', description: 'Does the second thing.' },
];

test('landing screen renders the application name and description', () => {
  render(<LandingScreen features={sampleFeatures} />);

  expect(screen.getByRole('heading', { level: 1, name: appStrings.name })).toBeDefined();
  expect(screen.getByText(appStrings.description)).toBeDefined();
});

test('landing screen links to every feature by title', () => {
  render(<LandingScreen features={sampleFeatures} />);

  const featureList = screen.getByRole('list', { name: featureStrings.heading });
  const links = within(featureList).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/first', '/second']);
  expect(within(featureList).getByRole('link', { name: /First tool/ })).toBeDefined();
  expect(within(featureList).getByText('Does the second thing.')).toBeDefined();
});

test('landing screen offers sign-out as a form post', () => {
  render(<LandingScreen features={sampleFeatures} />);

  const signOut = screen.getByRole('button', { name: authStrings.signOut });
  const form = signOut.closest('form');
  expect(form?.getAttribute('method')).toBe('post');
  expect(form?.getAttribute('action')).toBe('/api/auth/sign-out');
});
