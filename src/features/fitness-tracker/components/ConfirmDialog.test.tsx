import { fireEvent, render, screen } from '@testing-library/react';
import { type LucideIcon, Trash2 } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderDialog(
    overrides: { disabled?: boolean; triggerIcon?: LucideIcon; triggerVariant?: 'deleteIcon' } = {},
  ) {
    const onConfirm = vi.fn();
    const view = render(
      <ConfirmDialog
        triggerLabel="Remove block"
        message="Remove block 2?"
        confirmLabel="Yes, remove"
        onConfirm={onConfirm}
        {...overrides}
      />,
    );
    const dialog = view.container.querySelector('dialog');
    if (!dialog) {
      throw new Error('The dialog element is missing');
    }
    return { onConfirm, dialog };
  }

  it('FR-038: stays closed, and asks nothing, until the trigger is tapped', () => {
    const { dialog, onConfirm } = renderDialog();

    expect(dialog.open).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('opens with the message, a confirm button and Cancel', () => {
    const { dialog } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Remove block' }));

    expect(dialog.open).toBe(true);
    expect(screen.getByText('Remove block 2?')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Yes, remove' })).toBeDefined();
    expect(screen.getByRole('button', { name: fitnessStrings.common.cancel })).toBeDefined();
  });

  it('confirming runs the action once and closes', () => {
    const { dialog, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Remove block' }));

    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
  });

  it('cancelling closes without running the action', () => {
    const { dialog, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Remove block' }));

    fireEvent.click(screen.getByRole('button', { name: fitnessStrings.common.cancel }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialog.open).toBe(false);
  });

  it('can be disabled', () => {
    renderDialog({ disabled: true });

    const trigger = screen.getByRole('button', { name: 'Remove block' });
    expect(trigger instanceof HTMLButtonElement && trigger.disabled).toBe(true);
  });

  it('shows a decorative icon in the trigger without changing its name', () => {
    renderDialog({ triggerIcon: Trash2 });

    const trigger = screen.getByRole('button', { name: 'Remove block' });
    const icon = trigger.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('can be a trash can icon alone, named by its label', () => {
    renderDialog({ triggerVariant: 'deleteIcon' });

    const trigger = screen.getByRole('button', { name: 'Remove block' });
    expect(trigger.textContent).toBe('');
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(trigger);
    expect(screen.getByText('Remove block 2?')).toBeDefined();
  });

  it('shows no icon unless one is given', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Remove block' }).querySelector('svg')).toBeNull();
  });
});
