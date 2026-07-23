import { Injectable } from '@nestjs/common';
import { BaseGenerator, GenerationContext, GeneratorResult } from './base.generator';
import { formatValue } from './format.util';

const BOM = '﻿';

/**
 * CSV generator. UTF-8 BOM for Excel compatibility, configurable delimiter,
 * RFC-4180 escaping. Builds output incrementally to stay memory-friendly.
 */
@Injectable()
export class CsvGenerator extends BaseGenerator {
  readonly format = 'csv' as const;

  async generate(ctx: GenerationContext): Promise<GeneratorResult> {
    const { columns } = ctx.layout;
    const delimiter = ctx.layout.delimiter ?? ',';
    const rows = this.sortRows(ctx);

    const lines: string[] = [];
    lines.push(columns.map((c) => escape(c.header, delimiter)).join(delimiter));

    for (const row of rows) {
      const cells = columns.map((c) => escape(formatValue(row[c.field], c.format), delimiter));
      lines.push(cells.join(delimiter));
    }

    // Append summary rows below a blank separator line.
    if (ctx.dataset.summary.length) {
      lines.push('');
      for (const s of ctx.dataset.summary) {
        lines.push(
          [escape(s.label, delimiter), escape(formatValue(s.value, s.format), delimiter)].join(
            delimiter,
          ),
        );
      }
    }

    const buffer = Buffer.from(BOM + lines.join('\r\n'), 'utf8');
    return { buffer, contentType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
}

function escape(value: string, delimiter: string): string {
  const needsQuote =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
