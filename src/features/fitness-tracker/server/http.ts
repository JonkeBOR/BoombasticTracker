import 'server-only';
import type { SessionClaims } from '@/lib/session-token';
import type { FitnessErrorCode } from '../domain/errors';
import { fail, type Result, succeed } from '../domain/result';

const badRequestCodes: readonly FitnessErrorCode[] = [
  'invalid-body',
  'name-required',
  'name-too-long',
  'invalid-weight',
  'invalid-reps',
  'invalid-target',
  'invalid-block-count',
  'invalid-time-zone',
  'invalid-position',
  'invalid-block',
  'prescription-needs-a-set',
];

export function statusFor(code: FitnessErrorCode): number {
  if (code === 'unauthorized') {
    return 401;
  }
  if (code === 'not-found') {
    return 404;
  }
  if (code === 'unexpected') {
    return 500;
  }
  return badRequestCodes.includes(code) ? 400 : 409;
}

export function errorResponse(code: FitnessErrorCode): Response {
  return Response.json({ error: code }, { status: statusFor(code) });
}

export function respond<T, E extends FitnessErrorCode>(result: Result<T, E>): Response {
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json(result.value ?? {}, { status: 200 });
}

export function respondWith<T, U, E extends FitnessErrorCode>(
  result: Result<T, E>,
  toBody: (value: T) => U,
): Response {
  return result.ok
    ? Response.json(toBody(result.value), { status: 200 })
    : errorResponse(result.error);
}

export function respondEmpty<T, E extends FitnessErrorCode>(result: Result<T, E>): Response {
  return respondWith(result, () => ({}));
}

export function authorize(
  session: SessionClaims | null,
): { ok: true; session: SessionClaims } | { ok: false; response: Response } {
  return session ? { ok: true, session } : { ok: false, response: errorResponse('unauthorized') };
}

export type JsonBody = Record<string, unknown>;

function isJsonBody(value: unknown): value is JsonBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJson(request: Request): Promise<Result<JsonBody, 'invalid-body'>> {
  try {
    const parsed: unknown = await request.json();
    return isJsonBody(parsed) ? succeed(parsed) : fail('invalid-body');
  } catch {
    return fail('invalid-body');
  }
}

export function hasKey(body: JsonBody, key: string): boolean {
  return Object.hasOwn(body, key);
}

export function readString(body: JsonBody, key: string): Result<string, 'invalid-body'> {
  const value = body[key];
  return typeof value === 'string' ? succeed(value) : fail('invalid-body');
}

export function readNullableString(
  body: JsonBody,
  key: string,
): Result<string | null, 'invalid-body'> {
  const value = body[key];
  if (value === null) {
    return succeed(null);
  }
  return typeof value === 'string' ? succeed(value) : fail('invalid-body');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function readNumber(body: JsonBody, key: string): Result<number, 'invalid-body'> {
  const value = body[key];
  return isFiniteNumber(value) ? succeed(value) : fail('invalid-body');
}

export function readNullableNumber(
  body: JsonBody,
  key: string,
): Result<number | null, 'invalid-body'> {
  const value = body[key];
  if (value === null) {
    return succeed(null);
  }
  return isFiniteNumber(value) ? succeed(value) : fail('invalid-body');
}

export function readBoolean(body: JsonBody, key: string): Result<boolean, 'invalid-body'> {
  const value = body[key];
  return typeof value === 'boolean' ? succeed(value) : fail('invalid-body');
}

export function readNumberArray(body: JsonBody, key: string): Result<number[], 'invalid-body'> {
  const value = body[key];
  if (!Array.isArray(value)) {
    return fail('invalid-body');
  }
  const entries: unknown[] = value;
  const numbers: number[] = [];
  for (const entry of entries) {
    if (!isFiniteNumber(entry)) {
      return fail('invalid-body');
    }
    numbers.push(entry);
  }
  return succeed(numbers);
}
