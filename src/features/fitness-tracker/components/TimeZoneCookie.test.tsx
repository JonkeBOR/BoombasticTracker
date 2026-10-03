import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TimeZoneCookie } from './TimeZoneCookie';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function clearCookie() {
  document.cookie = 'tz=; Path=/; Max-Age=0';
}

beforeEach(() => {
  clearCookie();
});

afterEach(() => {
  clearCookie();
  router.refresh.mockReset();
});

it('R10: writes the device time zone and refreshes once when the cookie is missing', () => {
  render(<TimeZoneCookie />);

  expect(document.cookie).toContain(`tz=${encodeURIComponent(deviceZone)}`);
  expect(router.refresh).toHaveBeenCalledTimes(1);
});

it('R10: rewrites the cookie and refreshes when it holds another time zone', () => {
  document.cookie = 'tz=Pacific%2FAuckland; Path=/';
  if (deviceZone === 'Pacific/Auckland') {
    return;
  }

  render(<TimeZoneCookie />);

  expect(document.cookie).toContain(`tz=${encodeURIComponent(deviceZone)}`);
  expect(router.refresh).toHaveBeenCalledTimes(1);
});

it('R10: does nothing when the cookie already matches the device', () => {
  document.cookie = `tz=${encodeURIComponent(deviceZone)}; Path=/`;

  render(<TimeZoneCookie />);

  expect(router.refresh).not.toHaveBeenCalled();
});

it('renders nothing', () => {
  const { container } = render(<TimeZoneCookie />);

  expect(container.innerHTML).toBe('');
});
