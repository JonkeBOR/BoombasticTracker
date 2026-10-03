import { describe, expect, it } from 'vitest';
import { readId, readNumberField, readStringField } from './read-id';

describe('readId', () => {
  it('reads the id of a response body', () => {
    expect(readId({ id: 'p1', name: 'Strength' })).toBe('p1');
  });

  it.each([[null], [undefined], ['p1'], [{}], [{ id: 3 }], [[]]])('gives null for %j', (value) => {
    expect(readId(value)).toBeNull();
  });
});

describe('readStringField', () => {
  it('reads a named string field', () => {
    expect(readStringField({ sessionId: 's1' }, 'sessionId')).toBe('s1');
  });

  it.each([[null], [{}], [{ sessionId: 3 }], ['text']])('gives null for %j', (value) => {
    expect(readStringField(value, 'sessionId')).toBeNull();
  });
});

describe('readNumberField', () => {
  it('reads a named number field', () => {
    expect(readNumberField({ completedBlockNumber: 3 }, 'completedBlockNumber')).toBe(3);
  });

  it.each([[null], [{}], [{ completedBlockNumber: '3' }], [7]])('gives null for %j', (value) => {
    expect(readNumberField(value, 'completedBlockNumber')).toBeNull();
  });
});
