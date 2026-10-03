import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { NewProgramForm } from './NewProgramForm';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('NewProgramForm', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    router.push.mockReset();
  });

  function field(label: string): HTMLInputElement {
    const element = screen.getByLabelText(label);
    if (!(element instanceof HTMLInputElement)) {
      throw new Error(`${label} is not an input`);
    }
    return element;
  }

  it('FR-025: defaults to four blocks and a numeric keypad', () => {
    render(<NewProgramForm />);

    expect(field(fitnessStrings.programs.blocksLabel).value).toBe('4');
    expect(field(fitnessStrings.programs.blocksLabel).getAttribute('inputmode')).toBe('numeric');
    expect(field(fitnessStrings.programs.nameLabel).value).toBe('');
  });

  it('US3 scenario 1: creates the program and opens its edit page', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'p9' }));
    render(<NewProgramForm />);

    fireEvent.change(field(fitnessStrings.programs.nameLabel), { target: { value: 'Strength' } });
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programs.create }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/fitness-tracker/programs/p9'));
    expect(fetchMock).toHaveBeenCalledWith('/api/fitness/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Strength', blockCount: 4 }),
    });
  });

  it.each(['0', '', 'x', '2.5', '-1'])('FR-013: refuses %j blocks without a request', (text) => {
    render(<NewProgramForm />);

    fireEvent.change(field(fitnessStrings.programs.nameLabel), { target: { value: 'Strength' } });
    fireEvent.change(field(fitnessStrings.programs.blocksLabel), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programs.create }));

    expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['invalid-block-count']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('FR-013: shows a refused name inline and stays on the page', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'name-required' }, { status: 400 }));
    render(<NewProgramForm />);

    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.programs.create }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(fitnessErrorStrings['name-required']),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});
