import { BadRequestException } from '@nestjs/common';
import { sampleParameters, validateParameters } from './parameter-validator';
import type { ParametersSchema } from '../types/report.types';

const schema: ParametersSchema = {
  date_from: { type: 'date', required: true },
  date_to: { type: 'date', required: true },
  status: { type: 'string', required: false, default: 'all', enum: ['all', 'completed'] },
  limit: { type: 'number', required: false, default: 10 },
};

describe('validateParameters', () => {
  it('applies defaults for omitted optional params', () => {
    const out = validateParameters(schema, {
      date_from: '2026-01-01',
      date_to: '2026-02-01',
    });
    expect(out.status).toBe('all');
    expect(out.limit).toBe(10);
    expect(out.date_from).toBeInstanceOf(Date);
  });

  it('coerces numbers and dates', () => {
    const out = validateParameters(schema, {
      date_from: '2026-01-01',
      date_to: '2026-02-01',
      limit: '25',
    });
    expect(out.limit).toBe(25);
  });

  it('throws when a required param is missing', () => {
    expect(() => validateParameters(schema, { date_to: '2026-02-01' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects values outside an enum', () => {
    expect(() =>
      validateParameters(schema, {
        date_from: '2026-01-01',
        date_to: '2026-02-01',
        status: 'nope',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid dates', () => {
    expect(() =>
      validateParameters(schema, { date_from: 'not-a-date', date_to: '2026-02-01' }),
    ).toThrow(BadRequestException);
  });
});

describe('sampleParameters', () => {
  it('produces a value for every key', () => {
    const sample = sampleParameters(schema);
    expect(Object.keys(sample).sort()).toEqual(
      ['date_from', 'date_to', 'limit', 'status'].sort(),
    );
    expect(sample.status).toBe('all');
  });
});
