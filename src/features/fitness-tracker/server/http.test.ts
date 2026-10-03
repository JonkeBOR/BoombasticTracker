import { describe, expect, it } from 'vitest';
import { fitnessErrorCodes } from '../domain/errors';
import { fail, succeed } from '../domain/result';
import {
  authorize,
  errorResponse,
  hasKey,
  readBoolean,
  readJson,
  readNullableNumber,
  readNullableString,
  readNumber,
  readNumberArray,
  readString,
  respond,
  respondEmpty,
  respondWith,
  statusFor,
} from './http';

function jsonRequest(body: string): Request {
  return new Request('https://app.example.com/api/fitness/x', { method: 'POST', body });
}

describe('authorize', () => {
  it('FR-001: answers 401 without a session', async () => {
    const result = authorize(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toEqual({ error: 'unauthorized' });
    }
  });

  it('passes the session on when there is one', () => {
    const session = { sub: 'owner', email: 'owner@example.com' };

    expect(authorize(session)).toEqual({ ok: true, session });
  });
});

describe('statusFor', () => {
  it.each([
    ['unauthorized', 401],
    ['not-found', 404],
    ['name-required', 400],
    ['name-too-long', 400],
    ['invalid-weight', 400],
    ['invalid-reps', 400],
    ['invalid-target', 400],
    ['invalid-block-count', 400],
    ['invalid-time-zone', 400],
    ['invalid-position', 400],
    ['invalid-block', 400],
    ['invalid-body', 400],
    ['prescription-needs-a-set', 400],
    ['name-taken', 409],
    ['already-weighed-in-today', 409],
    ['set-already-logged', 409],
    ['program-incomplete', 409],
    ['unexpected', 500],
  ] as const)('maps %s to %i', (code, status) => {
    expect(statusFor(code)).toBe(status);
  });

  it('gives every code one of the documented statuses', () => {
    for (const code of fitnessErrorCodes) {
      expect([400, 401, 404, 409, 500]).toContain(statusFor(code));
    }
  });
});

describe('respond', () => {
  it('answers 200 with the value as JSON', async () => {
    const response = respond(succeed({ id: 'e1', name: 'Squat' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'e1', name: 'Squat' });
  });

  it('answers an empty object when the operation returns nothing', async () => {
    const response = respond(succeed(undefined));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  it('serialises dates as ISO strings', async () => {
    const response = respond(succeed({ at: new Date('2026-10-03T08:00:00Z') }));

    expect(await response.json()).toEqual({ at: '2026-10-03T08:00:00.000Z' });
  });

  it('answers a refusal with its status and its code only', async () => {
    const response = respond(fail('name-taken'));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'name-taken' });
  });
});

describe('respondWith and respondEmpty', () => {
  it('maps the value to the body', async () => {
    const response = respondWith(succeed({ id: 'p1', name: 'Strength' }), (program) => ({
      id: program.id,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'p1' });
  });

  it('answers an empty object for respondEmpty', async () => {
    expect(await respondEmpty(succeed({ anything: 1 })).json()).toEqual({});
  });

  it('passes a refusal through without mapping', async () => {
    const response = respondWith(fail('not-found'), () => ({ never: true }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not-found' });
  });
});

describe('errorResponse', () => {
  it('SC-006: never carries more than the code', async () => {
    const response = errorResponse('unexpected');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'unexpected' });
  });
});

describe('readJson', () => {
  it('reads a JSON object', async () => {
    expect(await readJson(jsonRequest('{"name":"Squat"}'))).toEqual({
      ok: true,
      value: { name: 'Squat' },
    });
  });

  it.each([['not json'], ['null'], ['[1,2]'], ['"text"'], ['']])(
    'refuses %j as invalid-body',
    async (text) => {
      expect(await readJson(jsonRequest(text))).toEqual({ ok: false, error: 'invalid-body' });
    },
  );
});

describe('body readers', () => {
  const body = {
    text: 'a',
    count: 3,
    nothing: null,
    flag: false,
    list: [1, 2, 3],
    mixed: [1, 'x'],
  };

  it('readString', () => {
    expect(readString(body, 'text')).toEqual({ ok: true, value: 'a' });
    expect(readString(body, 'count')).toEqual({ ok: false, error: 'invalid-body' });
    expect(readString(body, 'missing')).toEqual({ ok: false, error: 'invalid-body' });
  });

  it('readNumber', () => {
    expect(readNumber(body, 'count')).toEqual({ ok: true, value: 3 });
    expect(readNumber(body, 'text')).toEqual({ ok: false, error: 'invalid-body' });
    expect(readNumber({ count: Number.NaN }, 'count')).toEqual({
      ok: false,
      error: 'invalid-body',
    });
  });

  it('readNullableNumber', () => {
    expect(readNullableNumber(body, 'count')).toEqual({ ok: true, value: 3 });
    expect(readNullableNumber(body, 'nothing')).toEqual({ ok: true, value: null });
    expect(readNullableNumber(body, 'missing')).toEqual({ ok: false, error: 'invalid-body' });
    expect(readNullableNumber(body, 'text')).toEqual({ ok: false, error: 'invalid-body' });
  });

  it('readNullableString', () => {
    expect(readNullableString(body, 'text')).toEqual({ ok: true, value: 'a' });
    expect(readNullableString(body, 'nothing')).toEqual({ ok: true, value: null });
    expect(readNullableString(body, 'count')).toEqual({ ok: false, error: 'invalid-body' });
    expect(readNullableString(body, 'missing')).toEqual({ ok: false, error: 'invalid-body' });
  });

  it('readBoolean', () => {
    expect(readBoolean(body, 'flag')).toEqual({ ok: true, value: false });
    expect(readBoolean(body, 'count')).toEqual({ ok: false, error: 'invalid-body' });
  });

  it('readNumberArray', () => {
    expect(readNumberArray(body, 'list')).toEqual({ ok: true, value: [1, 2, 3] });
    expect(readNumberArray(body, 'mixed')).toEqual({ ok: false, error: 'invalid-body' });
    expect(readNumberArray(body, 'count')).toEqual({ ok: false, error: 'invalid-body' });
  });

  it('hasKey', () => {
    expect(hasKey(body, 'text')).toBe(true);
    expect(hasKey(body, 'nothing')).toBe(true);
    expect(hasKey(body, 'missing')).toBe(false);
  });
});
