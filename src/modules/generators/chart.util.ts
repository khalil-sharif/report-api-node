import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';
import type { ChartConfig, DataRow } from 'src/common/types/report.types';

/**
 * Renders a chart to a PNG buffer using chart.js on a node canvas. Aggregates
 * the dataset by the configured label field before plotting.
 */
const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

let canvas: ChartJSNodeCanvas | undefined;
function getCanvas(): ChartJSNodeCanvas {
  if (!canvas) {
    canvas = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white',
    });
  }
  return canvas;
}

export function aggregateForChart(
  rows: DataRow[],
  chart: ChartConfig,
): { labels: string[]; values: number[] } {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const label = String(row[chart.labelField] ?? '—');
    const value = Number(row[chart.dataField]);
    if (!buckets.has(label)) buckets.set(label, []);
    if (Number.isFinite(value)) buckets.get(label)!.push(value);
  }

  const labels: string[] = [];
  const values: number[] = [];
  const op = chart.aggregate ?? 'sum';
  for (const [label, nums] of buckets.entries()) {
    labels.push(label);
    values.push(reduceOp(nums, op));
  }
  return { labels, values };
}

function reduceOp(nums: number[], op: string): number {
  if (!nums.length) return 0;
  switch (op) {
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'count':
      return nums.length;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    case 'sum':
    default:
      return nums.reduce((a, b) => a + b, 0);
  }
}

export async function renderChartPng(rows: DataRow[], chart: ChartConfig): Promise<Buffer> {
  const { labels, values } = aggregateForChart(rows, chart);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  const configuration: ChartConfiguration = {
    type: chart.type,
    data: {
      labels,
      datasets: [
        {
          label: chart.title ?? chart.dataField,
          data: values,
          backgroundColor: chart.type === 'line' ? colors[0] : colors,
          borderColor: chart.type === 'line' ? colors[0] : colors,
          borderWidth: chart.type === 'line' ? 2 : 1,
          fill: false,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: chart.type === 'pie' },
        title: { display: !!chart.title, text: chart.title ?? '' },
      },
      scales:
        chart.type === 'pie'
          ? {}
          : { y: { beginAtZero: true } },
    },
  };

  return getCanvas().renderToBuffer(configuration);
}
