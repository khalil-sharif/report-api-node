/** Shared shapes for template layout config and parameter contracts. */

export type ColumnFormat = 'string' | 'number' | 'date' | 'currency' | 'percent';

export interface ColumnConfig {
  field: string;
  header: string;
  width?: number;
  format?: ColumnFormat;
}

export type SummaryOp = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface SummaryConfig {
  field: string;
  op: SummaryOp;
  label: string;
  format?: ColumnFormat;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie';
  labelField: string;
  dataField: string;
  aggregate?: SummaryOp;
  title?: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface LayoutConfig {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  columns: ColumnConfig[];
  summary?: SummaryConfig[];
  groupBy?: string;
  sortBy?: SortConfig;
  chart?: ChartConfig;
  delimiter?: ',' | ';' | '\t';
}

export type ParamType = 'string' | 'number' | 'boolean' | 'date';

export interface ParameterSpec {
  type: ParamType;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  label?: string;
}

export type ParametersSchema = Record<string, ParameterSpec>;

/** A single data row from a report query. */
export type DataRow = Record<string, unknown>;

export interface SummaryStat {
  label: string;
  field: string;
  op: SummaryOp;
  value: number;
  format?: ColumnFormat;
}

export interface ReportDataset {
  rows: DataRow[];
  summary: SummaryStat[];
  rowCount: number;
  fromCache: boolean;
}
