import * as ExcelJS from 'exceljs';
import { CsvGenerator } from './csv.generator';
import { ExcelGenerator } from './excel.generator';
import { PdfGenerator } from './pdf.generator';
import { GenerationContext } from './base.generator';
import type { LayoutConfig, ReportDataset } from 'src/common/types/report.types';

const layout: LayoutConfig = {
  title: 'Test Report',
  subtitle: 'unit test',
  columns: [
    { field: 'customer', header: 'Customer', format: 'string' },
    { field: 'amount', header: 'Amount', format: 'currency' },
    { field: 'created_at', header: 'Date', format: 'date' },
  ],
  summary: [{ field: 'amount', op: 'sum', label: 'Total', format: 'currency' }],
  sortBy: { field: 'amount', direction: 'desc' },
};

const dataset: ReportDataset = {
  rows: [
    { customer: 'Acme, Inc', amount: 100, created_at: '2026-01-01T00:00:00.000Z' },
    { customer: 'Globex', amount: 250, created_at: '2026-01-02T00:00:00.000Z' },
  ],
  summary: [{ label: 'Total', field: 'amount', op: 'sum', value: 350, format: 'currency' }],
  rowCount: 2,
  fromCache: false,
};

const ctx: GenerationContext = {
  layout,
  dataset,
  parameters: { date_from: '2026-01-01', date_to: '2026-02-01' },
  meta: {
    templateName: 'Test Report',
    generatedBy: 'tester',
    generatedAt: new Date('2026-01-15T12:00:00.000Z'),
    companyName: 'Acme Analytics',
  },
};

describe('CsvGenerator', () => {
  it('produces a UTF-8 BOM, header row, and escapes delimiters', async () => {
    const result = await new CsvGenerator().generate(ctx);
    const text = result.buffer.toString('utf8');
    expect(result.extension).toBe('csv');
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    const [header, first] = text.slice(1).split('\r\n');
    expect(header).toBe('Customer,Amount,Date');
    expect(first).toContain('"Acme, Inc"'); // comma-containing field quoted
  });
});

describe('ExcelGenerator', () => {
  it('creates Summary and Data sheets with a total formula', async () => {
    const result = await new ExcelGenerator().generate(ctx);
    expect(result.extension).toBe('xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.buffer as any);
    expect(wb.getWorksheet('Summary')).toBeDefined();
    const data = wb.getWorksheet('Data');
    expect(data).toBeDefined();
    // header + 2 data rows + total row
    expect(data!.rowCount).toBeGreaterThanOrEqual(4);
    const totalCell = data!.getRow(4).getCell(2).value as any;
    expect(totalCell).toHaveProperty('formula');
  });
});

describe('PdfGenerator', () => {
  it('produces a non-trivial PDF buffer', async () => {
    const result = await new PdfGenerator().generate(ctx);
    expect(result.extension).toBe('pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.buffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
    expect(result.buffer.length).toBeGreaterThan(1000);
  }, 20000);
});
