import type { LayoutConfig, ReportDataset } from 'src/common/types/report.types';

export interface GenerationContext {
  layout: LayoutConfig;
  dataset: ReportDataset;
  parameters: Record<string, unknown>;
  meta: {
    templateName: string;
    generatedBy: string;
    generatedAt: Date;
    companyName: string;
    companyLogoPath?: string;
  };
}

export interface GeneratorResult {
  buffer: Buffer;
  contentType: string;
  extension: 'pdf' | 'xlsx' | 'csv';
}

/**
 * Strategy interface. Each concrete generator turns a resolved dataset + layout
 * into a binary artifact. Kept intentionally small so new formats plug in cleanly.
 */
export abstract class BaseGenerator {
  abstract readonly format: 'pdf' | 'xlsx' | 'csv';
  abstract generate(ctx: GenerationContext): Promise<GeneratorResult>;

  /** Rows grouped by the layout's groupBy field, or a single group if unset. */
  protected groupRows(ctx: GenerationContext): Array<{ key: string | null; rows: any[] }> {
    const groupBy = ctx.layout.groupBy;
    if (!groupBy) return [{ key: null, rows: ctx.dataset.rows }];
    const map = new Map<string, any[]>();
    for (const row of ctx.dataset.rows) {
      const key = String(row[groupBy] ?? '—');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
  }

  /** Rows sorted per layout.sortBy (stable, no-op when unset). */
  protected sortRows(ctx: GenerationContext): any[] {
    const sort = ctx.layout.sortBy;
    const rows = [...ctx.dataset.rows];
    if (!sort) return rows;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return rows.sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av > bv ? dir : -dir;
    });
  }
}
