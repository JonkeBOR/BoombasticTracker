'use client';

import { ActionButton } from './ActionButton';
import { ConfirmActionButton } from './ConfirmActionButton';

type Method = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ConditionalConfirmButtonProps = {
  label: string;
  needsConfirm: boolean;
  confirmMessage: string;
  confirmLabel: string;
  method: Method;
  url: string;
  body?: unknown;
  disabled?: boolean;
};

export function ConditionalConfirmButton({
  label,
  needsConfirm,
  confirmMessage,
  confirmLabel,
  method,
  url,
  body,
  disabled = false,
}: ConditionalConfirmButtonProps) {
  if (needsConfirm) {
    return (
      <ConfirmActionButton
        triggerLabel={label}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        method={method}
        url={url}
        body={body}
        disabled={disabled}
      />
    );
  }
  return <ActionButton label={label} method={method} url={url} body={body} disabled={disabled} />;
}
