import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmActionButton } from './ConfirmActionButton';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('ConfirmActionButton', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
  });

  function renderButton() {
    render(
      <ConfirmActionButton
        triggerLabel="Remove it"
        message="Remove it for good?"
        confirmLabel="Yes, remove"
        method="DELETE"
        url="/api/fitness/slots/s1"
      />,
    );
  }

  it('FR-038: sends nothing until the user confirms', () => {
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the endpoint after confirming, then refreshes', async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fitness/slots/s1');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('does not call the endpoint when the user cancels', () => {
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.cancel }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('FR-013: shows a refusal inline', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'exercise-in-use' }, { status: 409 }));
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Remove it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['exercise-in-use']),
    );
  });
});
