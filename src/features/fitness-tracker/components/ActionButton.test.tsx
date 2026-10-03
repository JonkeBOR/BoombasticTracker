import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessErrorStrings } from '@/lib/strings/fitness';
import { ActionButton } from './ActionButton';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('ActionButton', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
  });

  it('sends the request on one tap and refreshes', async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    render(
      <ActionButton
        label="Add block"
        method="POST"
        url="/api/fitness/programs/p1/blocks"
        body={{}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add block' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/programs/p1/blocks');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{}');
  });

  it('hands the response to onSuccess instead of refreshing', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    const onSuccess = vi.fn();
    render(<ActionButton label="Go" method="POST" url="/api/x" onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true }));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('FR-013: shows a refusal inline', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'program-incomplete' }, { status: 409 }));
    render(<ActionButton label="Go" method="POST" url="/api/x" />);

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['program-incomplete']),
    );
  });
});
