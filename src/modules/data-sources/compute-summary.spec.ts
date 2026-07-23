import { computeSummary } from './data-source.service';
import type { DataRow, SummaryConfig } from 'src/common/types/report.types';

const rows: DataRow[] = [
  { amount: 10 },
  { amount: 20 },
  { amount: 30 },
];

describe('computeSummary', () => {
  it('computes sum, avg, count, min, max', () => {
    const config: SummaryConfig[] = [
      { field: 'amount', op: 'sum', label: 'Sum' },
      { field: 'amount', op: 'avg', label: 'Avg' },
      { field: 'amount', op: 'count', label: 'Count' },
      { field: 'amount', op: 'min', label: 'Min' },
      { field: 'amount', op: 'max', label: 'Max' },
    ];
    const out = computeSummary(rows, config);
    const byLabel = Object.fromEntries(out.map((s) => [s.label, s.value]));
    expect(byLabel.Sum).toBe(60);
    expect(byLabel.Avg).toBe(20);
    expect(byLabel.Count).toBe(3);
    expect(byLabel.Min).toBe(10);
    expect(byLabel.Max).toBe(30);
  });

  it('handles an empty dataset without NaN', () => {
    const out = computeSummary([], [{ field: 'amount', op: 'avg', label: 'Avg' }]);
    expect(out[0].value).toBe(0);
  });
});
