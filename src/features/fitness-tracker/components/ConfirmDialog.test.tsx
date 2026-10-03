import { fireEvent, render, screen } from '@testing-library/react';
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

  function renderDialog(overrides: { disabled?: boolean } = {}) {
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
});
