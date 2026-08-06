import { describe, expect, it } from 'vitest';
import { extractApiErrorMessage } from '@/lib/api-error';

describe('extractApiErrorMessage', () => {
  it('reads message from Axios-style response.data.error', () => {
    const err = { response: { data: { error: 'Server error' } } };
    expect(extractApiErrorMessage(err, 'fallback')).toBe('Server error');
  });

  it('falls back when the nested error is missing or wrong shape', () => {
    expect(extractApiErrorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage({ response: {} }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage({ response: null }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage({ response: { data: { error: 42 } } }, 'fallback')).toBe('fallback');
  });

  it('uses Error.message when no response shape matches', () => {
    expect(extractApiErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('falls back when the error has no message and no response', () => {
    expect(extractApiErrorMessage({ random: 1 }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage('plain string', 'fallback')).toBe('fallback');
  });
});
