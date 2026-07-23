import type { ColumnFormat, SummaryOp } from 'src/common/types/report.types';

/** Value formatting shared by every generator so output stays consistent. */

export function formatValue(value: unknown, format?: ColumnFormat): string {
  if (value === null || value === undefined || value === '') return '';
  switch (format) {
    case 'number':
      return formatNumber(Number(value));
    case 'currency':
      return formatCurrency(Number(value));
    case 'percent':
      return `${formatNumber(Number(value))}%`;
    case 'date':
      return formatDate(value);
    case 'string':
    default:
      return String(value);
  }
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export function formatDate(value: unknown): string {
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

/** Human label for a summary operation, e.g. "sum" -> "Total". */
export function opLabel(op: SummaryOp): string {
  const map: Record<SummaryOp, string> = {
    sum: 'Total',
    avg: 'Average',
    count: 'Count',
    min: 'Min',
    max: 'Max',
  };
  return map[op] ?? op;
}
