import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BackLink } from './BackLink';

it('FR-003: links to the parent view by name', () => {
  render(<BackLink href="/fitness-tracker/programs" label="Programs" />);

  expect(screen.getByRole('link', { name: 'Programs' }).getAttribute('href')).toBe(
    '/fitness-tracker/programs',
  );
});
