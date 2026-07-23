import { BadRequestException, Injectable } from '@nestjs/common';
import { BaseGenerator, GenerationContext, GeneratorResult } from './base.generator';
import { PdfGenerator } from './pdf.generator';
import { ExcelGenerator } from './excel.generator';
import { CsvGenerator } from './csv.generator';

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

/** Selects the generator strategy for a requested format. */
@Injectable()
export class GeneratorService {
  private readonly registry: Record<ReportFormat, BaseGenerator>;

  constructor(pdf: PdfGenerator, excel: ExcelGenerator, csv: CsvGenerator) {
    this.registry = { pdf, xlsx: excel, csv };
  }

  get(format: ReportFormat): BaseGenerator {
    const generator = this.registry[format];
    if (!generator) throw new BadRequestException(`Unsupported format: ${format}`);
    return generator;
  }

  generate(format: ReportFormat, ctx: GenerationContext): Promise<GeneratorResult> {
    return this.get(format).generate(ctx);
  }
}
