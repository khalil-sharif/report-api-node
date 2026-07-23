import { bindParameters } from './sql-binder';
import type { ParametersSchema } from 'src/common/types/report.types';

const schema: ParametersSchema = {
  date_from: { type: 'date' },
  date_to: { type: 'date' },
  status: { type: 'string' },
};

describe('bindParameters', () => {
  it('binds declared keys positionally up to the highest placeholder', () => {
    const sql = 'SELECT * FROM orders WHERE created_at BETWEEN $1 AND $2 AND status = $3';
    const bind = bindParameters(sql, schema, {
      date_from: 'a',
      date_to: 'b',
      status: 'completed',
    });
    expect(bind).toEqual(['a', 'b', 'completed']);
  });

  it('only consumes as many keys as placeholders used', () => {
    const sql = 'SELECT * FROM orders WHERE created_at >= $1';
    const bind = bindParameters(sql, schema, { date_from: 'a', date_to: 'b', status: 'c' });
    expect(bind).toEqual(['a']);
  });

  it('returns empty array when no placeholders', () => {
    expect(bindParameters('SELECT 1', schema, {})).toEqual([]);
  });
});
