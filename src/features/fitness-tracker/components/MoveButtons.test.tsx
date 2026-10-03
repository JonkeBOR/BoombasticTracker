import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fitnessStrings } from '@/lib/strings/fitness';
import { MoveButtons } from './MoveButtons';

function isDisabled(element: HTMLElement): boolean {
  return element instanceof HTMLButtonElement && element.disabled;
}

describe('MoveButtons', () => {
  it('moves an item up and down by one position, counting from 1', () => {
    const onMove = vi.fn();
    render(<MoveButtons itemName="Lower" index={1} count={3} onMove={onMove} />);

    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.moveUpFor('Lower') }));
    fireEvent.click(
      screen.getByRole('button', { name: fitnessStrings.common.moveDownFor('Lower') }),
    );

    expect(onMove.mock.calls).toEqual([[1], [3]]);
  });

  it('cannot move the first item up or the last item down', () => {
    const { rerender } = render(<MoveButtons itemName="A" index={0} count={2} onMove={vi.fn()} />);
    expect(
      isDisabled(screen.getByRole('button', { name: fitnessStrings.common.moveUpFor('A') })),
    ).toBe(true);

    rerender(<MoveButtons itemName="A" index={1} count={2} onMove={vi.fn()} />);
    expect(
      isDisabled(screen.getByRole('button', { name: fitnessStrings.common.moveDownFor('A') })),
    ).toBe(true);
  });
});
