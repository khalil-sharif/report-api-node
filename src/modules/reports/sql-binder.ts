import type { ParametersSchema } from 'src/common/types/report.types';

/**
 * Maps validated parameters to an ordered array bound to the query's
 * positional placeholders ($1, $2, …).
 *
 * Convention: placeholders bind to schema keys in DECLARED ORDER. A query that
 * references up to $N consumes the first N keys of the parameters schema. This
 * keeps binding predictable and, crucially, means user values are passed as
 * parameters — never interpolated into the SQL string.
 *
 * Example:
 *   schema keys: [date_from, date_to, status]
 *   query:       "... WHERE created_at BETWEEN $1 AND $2 AND status = $3"
 *   -> [values.date_from, values.date_to, values.status]
 */
export function bindParameters(
  sql: string,
  schema: ParametersSchema,
  values: Record<string, unknown>,
): unknown[] {
  const indexes = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const maxIndex = indexes.length ? Math.max(...indexes) : 0;
  if (maxIndex === 0) return [];

  const keys = Object.keys(schema);
  const bind: unknown[] = [];
  for (let i = 0; i < maxIndex; i++) {
    const key = keys[i];
    bind.push(key !== undefined ? (values[key] ?? null) : null);
  }
  return bind;
}
