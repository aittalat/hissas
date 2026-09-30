import { describe, expect, it } from 'vitest';
import { DAY_NAMES_AR, SCHOOL_DAYS, isDayMode } from './calendar';

describe('calendar', () => {
  it('covers Monday to Saturday like the prototype', () => {
    expect(SCHOOL_DAYS).toHaveLength(6);
    expect(DAY_NAMES_AR[0]).toBe('الإثنين');
    expect(DAY_NAMES_AR[5]).toBe('السبت');
  });

  it('accepts only the three day modes', () => {
    expect(['full', 'am', 'off'].every(isDayMode)).toBe(true);
    expect(isDayMode('pm')).toBe(false);
    expect(isDayMode(undefined)).toBe(false);
  });
});
