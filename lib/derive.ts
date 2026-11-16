import { fnv1a64 } from './hash';
import type { CellStats, Premise, WeightDelta, WeightSet } from './types';

export const cellKey = (r: number, c: number): string => `${r}:${c}`;

export const cellLabel = (r: number, c: number): string => `r${r}c${c}`;

/** The deltas a premise contributed to one tensor, in cell order. */
export function deltasFor(premise: Premise | null, tensorId: string): WeightDelta[] {
  if (!premise) return [];
  return premise.deltas.filter((d) => d.tensor === tensorId);
}

/** Cell keys a premise touched in this tensor. */
export function affectedKeys(premise: Premise | null, tensorId: string): Set<string> {
  return new Set(deltasFor(premise, tensorId).map((d) => cellKey(d.r, d.c)));
}

/**
 * Values after retracting `premise`, computed from the committed matrix.
 * Pure: never mutates `set.values`.
 */
export function previewValues(
  set: WeightSet,
  premise: Premise | null,
): { values: number[][]; deltas: Map<string, number> } {
  const deltas = new Map<string, number>();
  const base = set.values.map((row) => row.slice());
  if (!premise || set.status !== 'ready') return { values: base, deltas };
  for (const d of deltasFor(premise, set.id)) {
    const row = base[d.r];
    if (!row || row[d.c] === undefined) continue;
    row[d.c] = Number((row[d.c] - d.delta).toFixed(6));
    deltas.set(cellKey(d.r, d.c), d.delta);
  }
  return { values: base, deltas };
}

/** Aggregate statistics over the selected cells (or the whole tensor). */
export function statsOf(values: readonly (readonly number[])[], filter: Set<string> | null): CellStats {
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumSq = 0;
  let zeros = 0;
  let maxAbs = 0;
  for (let r = 0; r < values.length; r += 1) {
    const row = values[r];
    for (let c = 0; c < row.length; c += 1) {
      if (filter && !filter.has(cellKey(r, c))) continue;
      const v = row[c];
      count += 1;
      sum += v;
      sumSq += v * v;
      if (v === 0) zeros += 1;
      if (v < min) min = v;
      if (v > max) max = v;
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
  }
  const mean = count ? sum / count : 0;
  const variance = count ? Math.max(0, sumSq / count - mean * mean) : 0;
  return {
    count,
    min: count ? min : 0,
    max: count ? max : 0,
    mean,
    std: Math.sqrt(variance),
    maxAbs,
    l2: Math.sqrt(sumSq),
    zeros,
  };
}

export interface ParsedQuery {
  /** null means "no filter applied". */
  matches: Set<string> | null;
  /** Human description of what the filter means, for the header. */
  descriptor: string;
  error: string | null;
}

const NUM = /^[-+]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Cell search. Understands:
 *   r3        row 3
 *   c5        column 5
 *   r3c5      one cell
 *   >0.25     comparison (also >=, <, <=)
 *   =0        equality, same as a bare number
 *   0.37      equality
 * Anything else is treated as a literal text search over cell labels.
 */
export function parseQuery(raw: string, values: readonly (readonly number[])[]): ParsedQuery {
  const q = raw.trim();
  if (!q) return { matches: null, descriptor: 'all cells', error: null };

  const cell = /^r(\d+)c(\d+)$/i.exec(q);
  if (cell) {
    const r = Number(cell[1]);
    const c = Number(cell[2]);
    const ok = values[r] !== undefined && values[r][c] !== undefined;
    return {
      matches: new Set(ok ? [cellKey(r, c)] : []),
      descriptor: `cell ${cellLabel(r, c)}`,
      error: ok ? null : `no cell ${cellLabel(r, c)} in this tensor`,
    };
  }

  const row = /^r(\d+)$/i.exec(q);
  if (row) {
    const r = Number(row[1]);
    const keys = values[r] ? values[r].map((_, c) => cellKey(r, c)) : [];
    return {
      matches: new Set(keys),
      descriptor: `row ${r} (${keys.length} cells)`,
      error: keys.length ? null : `row ${r} is outside this tensor`,
    };
  }

  const col = /^c(\d+)$/i.exec(q);
  if (col) {
    const c = Number(col[1]);
    const keys: string[] = [];
    values.forEach((r, ri) => { if (r[c] !== undefined) keys.push(cellKey(ri, c)); });
    return {
      matches: new Set(keys),
      descriptor: `column ${c} (${keys.length} cells)`,
      error: keys.length ? null : `column ${c} is outside this tensor`,
    };
  }

  const cmp = /^(>=|<=|>|<|=)\s*(.+)$/.exec(q);
  if (cmp) {
    const op = cmp[1];
    const rawNum = cmp[2].trim();
    if (!NUM.test(rawNum)) {
      if (/^[-+]?(\d|\.)/.test(rawNum)) return { matches: new Set(), descriptor: '', error: `"${rawNum}" is not a number` };
      return { matches: new Set(), descriptor: '', error: null };
    }
    const t = Number(rawNum);
    const test = (v: number): boolean => {
      switch (op) {
        case '>': return v > t;
        case '>=': return v >= t;
        case '<': return v < t;
        case '<=': return v <= t;
        default: return Math.abs(v - t) < 1e-9;
      }
    };
    const keys = new Set<string>();
    values.forEach((r, ri) => r.forEach((v, ci) => { if (test(v)) keys.add(cellKey(ri, ci)); }));
    return { matches: keys, descriptor: `value ${op} ${rawNum} (${keys.size} cells)`, error: null };
  }

  if (NUM.test(q)) {
    return parseQuery(`=${q}`, values);
  }

  // literal search over labels such as r3c5
  const keys = new Set<string>();
  values.forEach((r, ri) => r.forEach((_, ci) => {
    if (cellLabel(ri, ci).includes(q.toLowerCase())) keys.add(cellKey(ri, ci));
  }));
  return { matches: keys, descriptor: `label contains "${q}" (${keys.size} cells)`, error: null };
}

/** Content hash of a tensor state plus the premises in force. */
export function stateHash(values: readonly (readonly number[])[], premiseIds: readonly string[]): string {
  const body = values.map((row) => row.join(',')).join(';');
  return fnv1a64(`${values.length}x${values[0]?.length ?? 0}|${body}|${[...premiseIds].sort().join(',')}`);
}

export function formatValue(v: number, digits = 4): string {
  if (Object.is(v, -0) || v === 0) return (0).toFixed(digits);
  return v.toFixed(digits);
}

export function formatDelta(v: number): string {
  const s = v.toFixed(4);
  return v > 0 ? `+${s}` : v < 0 ? s.replace('-', '−') : s;
}

/** How many cells differ between two matrices. */
export function changedCount(before: readonly (readonly number[])[], after: readonly (readonly number[])[]): number {
  let n = 0;
  for (let r = 0; r < before.length; r += 1) {
    for (let c = 0; c < before[r].length; c += 1) {
      if (before[r][c] !== after[r]?.[c]) n += 1;
    }
  }
  return n;
}

/** Flattened diff report for a premise on one tensor. */
export interface DiffRow {
  r: number;
  c: number;
  before: number;
  after: number;
  delta: number;
}

export function diffRows(set: WeightSet, premise: Premise | null): DiffRow[] {
  if (!premise || set.status !== 'ready') return [];
  return deltasFor(premise, set.id)
    .map((d) => {
      const before = set.values[d.r]?.[d.c];
      if (before === undefined) return null;
      return { r: d.r, c: d.c, before, after: Number((before - d.delta).toFixed(6)), delta: -d.delta };
    })
    .filter((row): row is DiffRow => row !== null);
}

/** Premises (in lineage order) that touched a given cell. */
export function premisesForCell(premises: readonly Premise[], tensorId: string, r: number, c: number): Premise[] {
  return premises.filter((p) => p.deltas.some((d) => d.tensor === tensorId && d.r === r && d.c === c));
}

/** Depth of a premise inside the lineage forest, for indentation. */
export function premiseDepth(premise: Premise, byId: Record<string, Premise>): number {
  let depth = 0;
  let cursor: Premise | undefined = premise;
  const seen = new Set<string>();
  while (cursor && cursor.parents.length > 0 && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    const parentId: string | undefined = cursor.parents[0];
    const parent: Premise | undefined = parentId ? byId[parentId] : undefined;
    if (!parent) break;
    cursor = parent;
    depth += 1;
    if (depth > 8) break;
  }
  return depth;
}

export function ancestorChain(premise: Premise, byId: Record<string, Premise>): Premise[] {
  const chain: Premise[] = [];
  let cursor: Premise | undefined = premise;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    const parentId: string | undefined = cursor.parents[0];
    cursor = parentId ? byId[parentId] : undefined;
  }
  return chain;
}
