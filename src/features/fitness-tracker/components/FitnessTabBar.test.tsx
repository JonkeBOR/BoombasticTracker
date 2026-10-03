import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessStrings } from '@/lib/strings/fitness';
import { FitnessTabBar } from './FitnessTabBar';

const navigation = vi.hoisted(() => ({
  pathname: '/fitness-tracker',
  router: { refresh: vi.fn(), push: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
}));

describe('FitnessTabBar', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    navigation.router.push.mockReset();
    navigation.pathname = '/fitness-tracker';
  });

  function homeTab() {
    return screen.getByRole('link', { name: fitnessStrings.tabBar.home });
  }

  function blockTab() {
    return screen.getByRole('link', { name: fitnessStrings.tabBar.block });
  }

  function workoutTab() {
    return screen.getByRole('button', { name: fitnessStrings.tabBar.workout });
  }

  it('is a labelled navigation with three icon tabs', () => {
    render(<FitnessTabBar />);

    expect(screen.getByRole('navigation', { name: fitnessStrings.tabBar.label })).toBeDefined();
    expect(homeTab().getAttribute('href')).toBe('/fitness-tracker');
    expect(blockTab().getAttribute('href')).toBe('/fitness-tracker/active/block');
    for (const tab of [homeTab(), blockTab(), workoutTab()]) {
      expect(tab.textContent).toBe('');
      expect(tab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it.each([
    ['/fitness-tracker', 'home'],
    ['/fitness-tracker/programs/p1', 'home'],
    ['/fitness-tracker/exercises', 'home'],
    ['/fitness-tracker/active', 'block'],
    ['/fitness-tracker/active/block', 'block'],
    ['/fitness-tracker/active/sessions/s1', 'workout'],
  ] as const)('marks the tab for %s as the current one (%s)', (pathname, current) => {
    navigation.pathname = pathname;
    render(<FitnessTabBar />);

    const tabs = { home: homeTab(), block: blockTab(), workout: workoutTab() };
    for (const [name, tab] of Object.entries(tabs)) {
      expect(tab.getAttribute('aria-current')).toBe(name === current ? 'page' : null);
    }
  });

  it('opens the upcoming session that the server picks', async () => {
    fetchMock.mockResolvedValue(Response.json({ sessionId: 's9' }));
    render(<FitnessTabBar />);

    fireEvent.click(workoutTab());

    await waitFor(() =>
      expect(navigation.router.push).toHaveBeenCalledWith('/fitness-tracker/active/sessions/s9'),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/active-program/session');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('falls back to the current block when there is no session to open', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'no-active-program' }, { status: 409 }));
    render(<FitnessTabBar />);

    fireEvent.click(workoutTab());

    await waitFor(() =>
      expect(navigation.router.push).toHaveBeenCalledWith('/fitness-tracker/active/block'),
    );
  });
});
