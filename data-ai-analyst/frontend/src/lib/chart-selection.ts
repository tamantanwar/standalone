import type { AskRow } from './types';

export type ColumnKind =
  | 'date'
  | 'date_component'
  | 'numeric'
  | 'id'
  | 'category'
  | 'boolean'
  | 'unknown';
export type NumericFormat = 'currency' | 'percent' | 'integer' | 'decimal';

export type ColumnInfo = {
  name: string;
  kind: ColumnKind;
  numericFormat?: NumericFormat;
  uniqueCount: number;
};

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

export type ChartSpec = {
  type: ChartType;
  xKey: string;
  yKeys: string[];
  seriesKey?: string;
  reason: string;
};

const DATE_LIKE_RE =
  /^\d{4}-\d{2}-\d{2}|^\d{4}\/\d{2}\/\d{2}|^\d{4}-\d{2}$|^\d{4}$/;

// Token-based naming dictionaries — match on whole tokens, not substrings,
// to avoid false hits like "salesperson" → currency.
const CURRENCY_TOKENS = new Set([
  // spend / cost
  'cost', 'costs', 'spend', 'spent', 'spending',
  // revenue / value
  'revenue', 'rev', 'sales', 'value', 'gmv', 'aov', 'ltv', 'cogs',
  // unit economics (always money)
  'cpc', 'cpm', 'cpa', 'cpl', 'cpi', 'cpv', 'cpe', 'rpc', 'rpm',
  // budgets / bids / payouts
  'budget', 'bid', 'price', 'amount', 'payout', 'commission',
]);

const PERCENT_TOKENS = new Set([
  'rate',
  'ctr',
  'cvr',
  'vtr',
  'cr',
  'pct',
  'percent',
  'percentage',
]);

const DATE_COMPONENT_TOKENS = new Set([
  'year',
  'yr',
  'month',
  'mo',
  'monthname',
  'day',
  'dayofweek',
  'dow',
  'weekday',
  'quarter',
  'qtr',
  'week',
  'weeknum',
  'isoweek',
  'hour',
  'minute',
]);

// "id" alone, or any *_id / id_* / *Id pattern.
const ID_NAME_RE = /(^|_)id($|_)|_id$|^id_/i;

function tokenize(name: string): string[] {
  // Split snake_case, kebab-case, dot.case, and camelCase into lowercase tokens.
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[_\s\-.]+/)
    .filter(Boolean);
}

function matchesAny(tokens: string[], dict: Set<string>): boolean {
  return tokens.some((t) => dict.has(t));
}

function inferNumericFormat(name: string): NumericFormat {
  const tokens = tokenize(name);
  if (matchesAny(tokens, CURRENCY_TOKENS)) return 'currency';
  if (matchesAny(tokens, PERCENT_TOKENS)) return 'percent';
  return 'decimal';
}

function isDateLike(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return DATE_LIKE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function isDateComponentName(name: string): boolean {
  const tokens = tokenize(name);
  return tokens.some((t) => DATE_COMPONENT_TOKENS.has(t));
}

function isIdLikeName(name: string): boolean {
  return ID_NAME_RE.test(name);
}

// Robust number coercion. BigQuery returns NUMERIC/BIGNUMERIC as strings; nulls
// must become null (not 0). NaN/non-finite → null so plots show gaps.
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const stripped = v.replace(/[$,]/g, '').trim();
    if (stripped === '') return null;
    const n = Number(stripped);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

function classifyColumn(name: string, values: unknown[]): ColumnInfo {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  const unique = new Set(nonNull.map((v) => String(v)));

  if (nonNull.length === 0) {
    return { name, kind: 'unknown', uniqueCount: 0 };
  }

  const allBool = nonNull.every((v) => typeof v === 'boolean');
  if (allBool) return { name, kind: 'boolean', uniqueCount: unique.size };

  // Numeric-or-string-numeric: BQ returns NUMERIC as string. Treat as numeric
  // if ≥80% of non-null values coerce to a finite number AND none look date-y.
  const coerced = nonNull.map(toNumber);
  const numericRatio = coerced.filter((n) => n !== null).length / nonNull.length;
  const looksDate = nonNull.some((v) => isDateLike(v));

  if (numericRatio >= 0.8 && !looksDate) {
    if (isDateComponentName(name)) {
      return { name, kind: 'date_component', uniqueCount: unique.size };
    }
    if (isIdLikeName(name)) {
      return { name, kind: 'id', uniqueCount: unique.size };
    }
    return {
      name,
      kind: 'numeric',
      numericFormat: inferNumericFormat(name),
      uniqueCount: unique.size,
    };
  }

  const dateRatio =
    nonNull.filter((v) => isDateLike(v)).length / nonNull.length;
  if (dateRatio >= 0.8) return { name, kind: 'date', uniqueCount: unique.size };

  return { name, kind: 'category', uniqueCount: unique.size };
}

export function inspectColumns(rows: AskRow[]): ColumnInfo[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) =>
    classifyColumn(
      k,
      rows.map((r) => r[k]),
    ),
  );
}

const SYNTH_PERIOD_KEY = '_period';

function pad(value: number, width: number): string {
  const s = String(Math.trunc(value));
  return s.padStart(width, '0');
}

function findDateComponent(
  cols: ColumnInfo[],
  ...names: string[]
): ColumnInfo | undefined {
  return cols.find(
    (c) =>
      c.kind === 'date_component' &&
      names.some((n) => tokenize(c.name).includes(n)),
  );
}

// If we see year + month (+ optional day) numeric columns, synthesize an
// ISO-like period string so the line chart treats time as a real ordered axis.
function synthesizePeriodColumn(
  rows: AskRow[],
  cols: ColumnInfo[],
): { rows: AskRow[]; periodKey?: string; consumedNames?: string[] } {
  const yearCol = findDateComponent(cols, 'year', 'yr');
  if (!yearCol) return { rows };

  const monthCol = findDateComponent(cols, 'month', 'mo');
  const dayCol = findDateComponent(cols, 'day');
  const quarterCol = !monthCol
    ? findDateComponent(cols, 'quarter', 'qtr')
    : undefined;
  const weekCol =
    !monthCol && !quarterCol
      ? findDateComponent(cols, 'week', 'weeknum', 'isoweek')
      : undefined;

  const consumed = [yearCol, monthCol, dayCol, quarterCol, weekCol]
    .filter((c): c is ColumnInfo => Boolean(c))
    .map((c) => c.name);

  const out = rows.map((r) => {
    const y = toNumber(r[yearCol.name]);
    if (y == null) return { ...r };
    let period = pad(y, 4);
    if (monthCol) {
      const m = toNumber(r[monthCol.name]);
      if (m != null) period += `-${pad(m, 2)}`;
      if (dayCol) {
        const d = toNumber(r[dayCol.name]);
        if (d != null) period += `-${pad(d, 2)}`;
      }
    } else if (quarterCol) {
      const q = toNumber(r[quarterCol.name]);
      if (q != null) period += `-Q${pad(q, 1)}`;
    } else if (weekCol) {
      const w = toNumber(r[weekCol.name]);
      if (w != null) period += `-W${pad(w, 2)}`;
    }
    return { ...r, [SYNTH_PERIOD_KEY]: period };
  });
  return { rows: out, periodKey: SYNTH_PERIOD_KEY, consumedNames: consumed };
}

export type PreparedPlot = {
  rows: AskRow[];
  charts: ChartSpec[];
  periodKey?: string;
};

// Group metrics by format so we never mix $1,000s and 0.04% on the same axis.
function groupMetricsByFormat(
  metrics: ColumnInfo[],
): Array<[NumericFormat, ColumnInfo[]]> {
  const map = new Map<NumericFormat, ColumnInfo[]>();
  for (const m of metrics) {
    const fmt = m.numericFormat ?? 'decimal';
    if (!map.has(fmt)) map.set(fmt, []);
    map.get(fmt)!.push(m);
  }
  return Array.from(map.entries());
}

export function preparePlot(rows: AskRow[]): PreparedPlot {
  if (rows.length < 2) return { rows, charts: [] };
  const cols = inspectColumns(rows);
  const { rows: workingRows, periodKey } = synthesizePeriodColumn(rows, cols);

  const dateCol = cols.find((c) => c.kind === 'date');
  // Fallback: a query like "weekly perf" may return only `week` (no year).
  // Still use it as the time axis.
  const looseDateComp = !periodKey && !dateCol
    ? cols.find((c) => c.kind === 'date_component')
    : undefined;
  const timeKey = periodKey ?? dateCol?.name ?? looseDateComp?.name;

  const metrics = cols.filter((c) => c.kind === 'numeric');
  const categories = cols.filter(
    (c) => c.kind === 'category' || c.kind === 'boolean',
  );

  const charts: ChartSpec[] = [];

  if (timeKey && metrics.length > 0) {
    const seriesCat = categories.find(
      (c) => c.uniqueCount >= 2 && c.uniqueCount <= 12,
    );
    if (seriesCat) {
      // One line chart per metric, lines split by category — answers
      // "spend / revenue / clicks over time by platform".
      for (const m of metrics) {
        charts.push({
          type: 'line',
          xKey: timeKey,
          yKeys: [m.name],
          seriesKey: seriesCat.name,
          reason: `${m.name} over time, split by ${seriesCat.name}`,
        });
      }
    } else {
      // No series — group metrics by format so spend ($) and CTR (%) get
      // separate charts instead of one with one line invisible.
      for (const [fmt, group] of groupMetricsByFormat(metrics)) {
        charts.push({
          type: 'line',
          xKey: timeKey,
          yKeys: group.map((m) => m.name),
          reason: `${fmt} metrics over time`,
        });
      }
    }
  } else if (categories.length > 0 && metrics.length > 0) {
    const cat = categories[0];
    if (cat.uniqueCount >= 2 && cat.uniqueCount <= 30) {
      // Same: split bar charts by metric format so scales are comparable.
      for (const [fmt, group] of groupMetricsByFormat(metrics)) {
        charts.push({
          type: 'bar',
          xKey: cat.name,
          yKeys: group.map((m) => m.name),
          reason: `${fmt} metrics by ${cat.name}`,
        });
      }
    }
    // Pie: only meaningful for additive currency/integer (share-of), never percent.
    const yMetric = metrics.find(
      (m) => m.numericFormat === 'currency' || m.numericFormat === 'decimal',
    );
    if (yMetric && cat.uniqueCount >= 2 && cat.uniqueCount <= 8) {
      const yKey = yMetric.name;
      const allPositive = workingRows.every((r) => {
        const n = toNumber(r[yKey]);
        return n !== null && n >= 0;
      });
      if (allPositive) {
        charts.push({
          type: 'pie',
          xKey: cat.name,
          yKeys: [yKey],
          reason: `share of ${yKey} by ${cat.name}`,
        });
      }
    }
  }

  // Scatter: only between two true currency/decimal metrics (skip percent —
  // CTR vs CPC is rarely a meaningful correlation view).
  const scatterCandidates = metrics.filter(
    (m) => m.numericFormat !== 'percent',
  );
  if (scatterCandidates.length >= 2) {
    charts.push({
      type: 'scatter',
      xKey: scatterCandidates[0].name,
      yKeys: [scatterCandidates[1].name],
      reason: `${scatterCandidates[1].name} vs ${scatterCandidates[0].name}`,
    });
  }

  return { rows: workingRows, charts, periodKey };
}

export function formatNumber(value: number, format?: NumericFormat): string {
  if (format === 'currency') {
    return value.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  }
  if (format === 'percent') {
    // Heuristic: BQ rates often come back as 0.04 (fraction); occasionally as 4.0
    // (already a percent). Treat |v| ≤ 1 as fraction.
    const v = Math.abs(value) <= 1 ? value * 100 : value;
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  }
  if (format === 'integer' || Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function tickFormatFor(format?: NumericFormat): string | undefined {
  if (format === 'currency') return '$,.2f';
  if (format === 'percent') return ',.2%';
  return undefined;
}

// Plotly d3-format hovertemplate format string for a metric.
export function hoverFormatFor(format?: NumericFormat): string {
  if (format === 'currency') return '$,.2f';
  if (format === 'percent') return ',.2%';
  return ',.2f';
}

export function topNRows(rows: AskRow[], yKey: string, n = 20): AskRow[] {
  const sorted = [...rows].sort((a, b) => {
    const av = toNumber(a[yKey]) ?? -Infinity;
    const bv = toNumber(b[yKey]) ?? -Infinity;
    return bv - av;
  });
  return sorted.slice(0, n);
}

export const CHART_COLORS = {
  primary: '#d9a48f',
  secondary: '#1a1a1a',
  tertiary: '#cfcfcf',
  palette: [
    '#d9a48f',
    '#1a1a1a',
    '#1e6fff',
    '#c98a72',
    '#6b6b6b',
    '#e63946',
    '#3d3d3d',
    '#ecdfd0',
  ],
};
