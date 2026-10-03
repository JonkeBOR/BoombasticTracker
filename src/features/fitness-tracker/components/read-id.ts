export function readStringField(value: unknown, key: string): string | null {
  if (typeof value === 'object' && value !== null && key in value) {
    const field: unknown = Object.getOwnPropertyDescriptor(value, key)?.value;
    return typeof field === 'string' ? field : null;
  }
  return null;
}

export function readId(value: unknown): string | null {
  return readStringField(value, 'id');
}

export function readNumberField(value: unknown, key: string): number | null {
  if (typeof value === 'object' && value !== null && key in value) {
    const field: unknown = Object.getOwnPropertyDescriptor(value, key)?.value;
    return typeof field === 'number' ? field : null;
  }
  return null;
}
