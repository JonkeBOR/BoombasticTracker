import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Screen } from './Screen';

const body = 'Body';

it('FR-003: shows the title, a back link and the content, with the content inside main', () => {
  render(
    <Screen title="Program edit" back={{ href: '/fitness-tracker/programs', label: 'Programs' }}>
      <p>{body}</p>
    </Screen>,
  );

  expect(screen.getByRole('heading', { level: 1, name: 'Program edit' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Programs' }).getAttribute('href')).toBe(
    '/fitness-tracker/programs',
  );
  expect(screen.getByRole('main').textContent).toBe(body);
});

it('has no back link when it is given none', () => {
  render(
    <Screen title="Home" back={null}>
      <p>{body}</p>
    </Screen>,
  );

  expect(screen.queryByRole('link')).toBeNull();
});
