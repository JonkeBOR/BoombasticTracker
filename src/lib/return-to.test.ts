import { expect, test } from 'vitest';
import { safeReturnTo } from './return-to';

test.each(['/', '/fitness-tracker', '/fitness-tracker?x=1'])('%s is kept', (path) => {
  expect(safeReturnTo(path)).toBe(path);
});

test.each([
  undefined,
  null,
  '',
  '//evil.com',
  '/\\evil.com',
  'https://evil.com',
  'evil',
  'javascript:alert(1)',
])('%j falls back to the landing page', (value) => {
  expect(safeReturnTo(value)).toBe('/');
});

test('the first value of a repeated parameter is used', () => {
  expect(safeReturnTo(['/fitness-tracker', '//evil.com'])).toBe('/fitness-tracker');
});
