import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { InlineError } from './InlineError';

it('FR-039: shows the message as an alert', () => {
  render(<InlineError message="That name is already used." />);

  expect(screen.getByRole('alert').textContent).toBe('That name is already used.');
});

it('renders nothing when there is no message', () => {
  const { container } = render(<InlineError message={null} />);

  expect(container.innerHTML).toBe('');
});
