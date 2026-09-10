import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { appStrings } from '@/lib/strings/app';
import LandingPage from './page';

test('landing page renders the application name and description', () => {
  render(<LandingPage />);

  expect(screen.getByRole('heading', { level: 1, name: appStrings.name })).toBeDefined();
  expect(screen.getByText(appStrings.description)).toBeDefined();
});
