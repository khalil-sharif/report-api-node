import { Module } from '@nestjs/common';
import { PdfGenerator } from './pdf.generator';
import { ExcelGenerator } from './excel.generator';
import { CsvGenerator } from './csv.generator';
import { GeneratorService } from './generator.service';

@Module({
  providers: [PdfGenerator, ExcelGenerator, CsvGenerator, GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorsModule {}
