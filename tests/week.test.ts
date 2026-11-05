import { describe, expect, it } from 'vitest';
import { weekStart, weekStartOfDate } from '../shared/week';

const utc = (s: string) => Date.parse(s) / 1000;

describe('weekStart', () => {
  it('월요일 00:00 UTC 로 내림', () => {
    expect(weekStart(utc('2024-01-01T00:00:00Z'))).toBe(utc('2024-01-01T00:00:00Z')); // 월
    expect(weekStart(utc('2024-01-07T23:59:59Z'))).toBe(utc('2024-01-01T00:00:00Z')); // 일
    expect(weekStart(utc('2024-01-08T00:00:00Z'))).toBe(utc('2024-01-08T00:00:00Z'));
    expect(weekStart(utc('1970-01-01T00:00:00Z'))).toBe(utc('1969-12-29T00:00:00Z'));
  });
  it('날짜 문자열', () => {
    expect(weekStartOfDate('2024-01-03')).toBe(utc('2024-01-01T00:00:00Z'));
    expect(weekStartOfDate('2024-01-01T09:00:00')).toBe(utc('2024-01-01T00:00:00Z'));
  });
});
