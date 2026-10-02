export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

export function succeed<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fail<E extends string>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}
