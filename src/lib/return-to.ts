export const defaultReturnTo = '/';

export function safeReturnTo(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate?.startsWith('/')) {
    return defaultReturnTo;
  }
  const secondCharacter = candidate.charAt(1);
  if (secondCharacter === '/' || secondCharacter === '\\') {
    return defaultReturnTo;
  }
  return candidate;
}
