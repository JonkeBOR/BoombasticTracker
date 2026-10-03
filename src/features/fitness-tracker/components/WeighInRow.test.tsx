import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { WeighInRow } from './WeighInRow';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('WeighInRow', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.refresh.mockReset();
  });

  function open() {
    render(<WeighInRow isAvailable lastEntryKg={74.5} />);
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.home.weighIn }));
    return screen.getByRole('textbox', { name: fitnessStrings.home.weighInInputLabel });
  }

  it('FR-010: opens a textbox with a decimal keypad, Save and Cancel', () => {
    const input = open();

    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(screen.getByRole('button', { name: fitnessStrings.common.save })).toBeDefined();
    expect(screen.getByRole('button', { name: fitnessStrings.common.cancel })).toBeDefined();
  });

  it('US2 scenario 5: cancelling closes the input without saving', () => {
    open();

    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.cancel }));

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('US2 scenario 2: saves the weight with the device time zone, then refreshes', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'x', date: '2026-10-03', weightKg: 74.2 }));
    const input = open();

    fireEvent.change(input, { target: { value: '74,2' } });
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.save }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/fitness/bodyweight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightKg: 74.2, timeZone: deviceZone }),
    });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it.each(['', 'abc', '74.123', '0'])(
    'FR-039: refuses %j on the device without a request',
    (text) => {
      const input = open();

      fireEvent.change(input, { target: { value: text } });
      fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.save }));

      expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['invalid-weight']);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('FR-013: shows the refusal when today already has an entry', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'already-weighed-in-today' }, { status: 409 }),
    );
    const input = open();

    fireEvent.change(input, { target: { value: '74' } });
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.save }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        fitnessErrorStrings['already-weighed-in-today'],
      ),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('disables Weigh in when no weigh-in is available', () => {
    render(<WeighInRow isAvailable={false} lastEntryKg={74.5} />);

    const button = screen.getByRole('button', { name: fitnessStrings.home.weighIn });
    expect(button instanceof HTMLButtonElement && button.disabled).toBe(true);
  });
});
