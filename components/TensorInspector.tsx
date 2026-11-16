'use client';

import { useMemo, useState } from 'react';
import {
  cellKey,
  cellLabel,
  formatDelta,
  formatValue,
  premisesForCell,
  statsOf,
  type DiffRow,
  type ParsedQuery,
} from '../lib/derive';
import type { CellStats, Premise, WeightSet } from '../lib/types';

interface TensorInspectorProps {
  set: WeightSet;
  booting: boolean;
  loading: boolean;
  recovering: boolean;
  onRetry: () => void;
  premise: Premise | null;
  diff: boolean;
  staged: boolean;
  after: number[][];
  deltas: Map<string, number>;
  query: string;
  onQueryChange: (q: string) => void;
  parsed: ParsedQuery;
  selectedCell: { r: number; c: number } | null;
  onSelectCell: (cell: { r: number; c: number } | null) => void;
  premises: readonly Premise[];
  onToggleDiff: () => void;
  onExitPreview: () => void;
  diffRows: DiffRow[];
  active: boolean;
}

const cellDomId = (r: number, c: number) => `cell-${r}-${c}`;

function StatCard({ label, value, delta }: { label: string; value: string; delta?: number }) {
  const cls = delta === undefined || Math.abs(delta) < 1e-9 ? 'flat' : delta > 0 ? 'up' : 'down';
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {delta !== undefined ? (
        <div className={`d ${cls}`}>{Math.abs(delta) < 1e-9 ? 'no change' : formatDelta(delta)}</div>
      ) : null}
    </div>
  );
}

function GridSkeleton({ rows = 9, cols = 12 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: '10px 12px' }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, marginBottom: 4 }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="skeleton sk-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TensorInspector({
  set,
  booting,
  loading,
  recovering,
  onRetry,
  premise,
  diff,
  staged,
  after,
  deltas,
  query,
  onQueryChange,
  parsed,
  selectedCell,
  onSelectCell,
  premises,
  onToggleDiff,
  onExitPreview,
  diffRows,
  active,
}: TensorInspectorProps) {
  const [focused, setFocused] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [showLog, setShowLog] = useState(false);

  const values = set.values;
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const matches = parsed.matches;
  const showDiff = Boolean(premise) && diff;

  const beforeStats: CellStats = useMemo(() => statsOf(values, matches), [values, matches]);
  const afterStats: CellStats = useMemo(() => statsOf(after, matches), [after, matches]);

  const busy = booting || loading;

  const move = (dr: number, dc: number) => {
    if (!rows || !cols) return;
    const next = {
      r: Math.min(rows - 1, Math.max(0, focused.r + dr)),
      c: Math.min(cols - 1, Math.max(0, focused.c + dc)),
    };
    setFocused(next);
    // Focus synchronously so keyboard navigation never lags behind the state.
    document.getElementById(cellDomId(next.r, next.c))?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLTableElement>) => {
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(-1, 0); break;
      case 'ArrowDown': e.preventDefault(); move(1, 0); break;
      case 'ArrowLeft': e.preventDefault(); move(0, -1); break;
      case 'ArrowRight': e.preventDefault(); move(0, 1); break;
      case 'Home': e.preventDefault(); move(0, -cols); break;
      case 'End': e.preventDefault(); move(0, cols); break;
      case 'PageUp': e.preventDefault(); move(-5, 0); break;
      case 'PageDown': e.preventDefault(); move(5, 0); break;
      case 'Enter': e.preventDefault(); onSelectCell({ r: focused.r, c: focused.c }); break;
      default: break;
    }
  };

  const selectedPremises = selectedCell
    ? premisesForCell(premises, set.id, selectedCell.r, selectedCell.c)
    : [];

  const selectedValue = selectedCell ? values[selectedCell.r]?.[selectedCell.c] : undefined;
  const selectedAfter = selectedCell ? after[selectedCell.r]?.[selectedCell.c] : undefined;
  const selectedDelta = selectedCell ? deltas.get(cellKey(selectedCell.r, selectedCell.c)) : undefined;

  const statsDelta = {
    mean: afterStats.mean - beforeStats.mean,
    maxAbs: afterStats.maxAbs - beforeStats.maxAbs,
    l2: afterStats.l2 - beforeStats.l2,
  };

  const body = () => {
    if (booting) {
      return (
        <>
          <div className="stats-row" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="stat" key={i}><div className="skeleton sk-line" style={{ width: 34 }} /><div className="skeleton sk-line" style={{ width: 52, height: 14 }} /></div>
            ))}
          </div>
          <GridSkeleton />
        </>
      );
    }
    if (loading) {
      return (
        <>
          <div className="stats-row" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="stat" key={i}><div className="skeleton sk-line" style={{ width: 34 }} /><div className="skeleton sk-line" style={{ width: 52, height: 14 }} /></div>
            ))}
          </div>
          <GridSkeleton rows={7} cols={10} />
        </>
      );
    }
    if (set.status === 'error') {
      return (
        <div style={{ padding: '14px 12px' }}>
          <div className="notice red" role="alert">
            <div>
              <div className="notice-title">Shard unavailable · {set.name}</div>
              <div>{set.statusDetail}</div>
              <div className="notice-actions">
                <button type="button" className="btn small primary" onClick={onRetry} disabled={recovering}>
                  {recovering ? 'Reconnecting…' : 'Retry shard'}
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => setShowLog((v) => !v)}
                  aria-expanded={showLog}
                  aria-controls="error-log"
                >
                  {showLog ? 'Hide log' : 'View transport log'}
                </button>
              </div>
            </div>
          </div>
          {showLog ? (
            <pre className="code" id="error-log" style={{ border: '1px solid var(--line)', borderRadius: 6 }}>
              {[
                '21:04:02.118  open   shard idle-7  shape=[12,10] dtype=f32',
                '21:04:02.640  recv   148_284 / 480_000 bytes',
                '21:04:32.651  warn   no bytes for 30.0 s',
                '21:04:32.652  error  ETIMEDOUT reading cells [4:12, 0:10]',
                '21:04:32.660  state  tensor not admitted; premises retained (pm-06, pm-08)',
              ].map((line) => (
                <div className="code-line" key={line}><span className="ln" aria-hidden="true">·</span><span className="ct">{line}</span></div>
              ))}
            </pre>
          ) : null}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
            A retry here is simulated: it reconnects to a generated shard so the inspector can be
            exercised. No network call is made.
          </p>
        </div>
      );
    }
    if (set.status === 'empty') {
      return (
        <div style={{ padding: '14px 12px' }}>
          <div className="state-card">
            <h4>No cells in {set.name}</h4>
            <p>{set.statusDetail}</p>
            <button type="button" className="btn small" onClick={() => onQueryChange('')}>
              Reset filters
            </button>
          </div>
        </div>
      );
    }
    if (matches && matches.size === 0) {
      return (
        <div style={{ padding: '14px 12px' }}>
          <div className="state-card">
            <h4>No cells match “{query}”</h4>
            <p>
              Search understands <code className="code-inline">r3</code>, <code className="code-inline">c5</code>,{' '}
              <code className="code-inline">r3c5</code>, comparisons like <code className="code-inline">&gt;0.25</code>, and
              bare numbers.
            </p>
            <button type="button" className="btn small" onClick={() => onQueryChange('')}>Clear search</button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="grid-wrap">
          <table
            className="tensor"
            role="grid"
            aria-label={`${set.name} weights, ${rows} rows by ${cols} columns`}
            aria-rowcount={rows + 1}
            aria-colcount={cols + 1}
            aria-busy={busy}
            onKeyDown={onGridKeyDown}
          >
            <thead>
              <tr>
                <th className="corner rowhead" scope="col" aria-label="Row header">r\c</th>
                {Array.from({ length: cols }).map((_, c) => (
                  <th key={c} scope="col">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {values.map((row, r) => (
                <tr key={r}>
                  <th className="rowhead" scope="row">{r}</th>
                  {row.map((v, c) => {
                    const key = cellKey(r, c);
                    const affected = Boolean(premise) && deltas.has(key);
                    const afterV = after[r]?.[c];
                    const changed = Boolean(premise) && diff && afterV !== undefined && afterV !== v;
                    const inSet = matches ? matches.has(key) : true;
                    const inFilter = inSet;
                    const dimmed = !inSet;
                    const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                    const isFocused = focused.r === r && focused.c === c;
                    const changeDir = changed ? (afterV! > v ? 'up' : 'down') : '';
                    return (
                      <td className="cell" key={c} role="presentation">
                        <button
                          type="button"
                          id={cellDomId(r, c)}
                          role="gridcell"
                          tabIndex={isFocused ? 0 : -1}
                          className={[
                            'cell-btn',
                            v === 0 ? 'zero' : '',
                            affected ? 'affected' : '',
                            changed ? `changed ${changeDir}` : '',
                            dimmed ? 'dimmed' : '',
                            isSelected ? 'selected' : '',
                            isFocused ? 'focused-cell' : '',
                          ].filter(Boolean).join(' ')}
                          aria-selected={isSelected}
                          aria-label={`${cellLabel(r, c)}, value ${formatValue(v)}${affected ? ', affected by the previewed premise' : ''}${changed ? `, becomes ${formatValue(afterV!)}` : ''}`}
                          onFocus={() => setFocused({ r, c })}
                          onClick={() => onSelectCell({ r, c })}
                        >
                          {changed ? (
                            <>
                              <span className="before" aria-hidden="true">{formatValue(v)}</span>
                              <span className="after">{formatValue(afterV!)}</span>
                            </>
                          ) : (
                            formatValue(v)
                          )}
                        </button>
                        <span className="sr-only">{inFilter ? '' : 'filtered out'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="legend">
          <span><i style={{ background: 'rgba(110,231,183,0.25)', border: '1px solid var(--accent-line)' }} />affected by preview</span>
          <span><i style={{ background: 'rgba(74,222,128,0.35)' }} />value rises on retraction</span>
          <span><i style={{ background: 'rgba(251,113,133,0.35)' }} />value falls on retraction</span>
          <span><i style={{ border: '1px solid var(--blue)' }} />selected cell</span>
        </div>
      </>
    );
  };

  return (
    <section className="pane pane-tensor" aria-labelledby="tensor-heading" data-active={active ? 'true' : 'false'}>
      <div className="pane-head">
        <h2 className="pane-title" id="tensor-heading">Tensor inspector</h2>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{set.name}</span>
        <span className="chip">{set.dtype}</span>
        {set.status === 'ready' ? (
          <span className="chip">{set.shape[0]}×{set.shape[1]} · {set.bytes.toLocaleString()} B</span>
        ) : null}
        <span className="pane-meta">
          {premise ? `${deltas.size} affected` : 'select a premise'}
        </span>
      </div>

      <div className="inspector-bar">
        <div className={`search-field ${parsed.error ? 'invalid' : ''}`}>
          <span aria-hidden="true" style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>⌕</span>
          <input
            id="tensor-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="r3c5 · >0.25 · row r4 · value"
            aria-label="Search cells by index or value"
            aria-describedby="query-note"
          />
          <span className="hint-key" aria-hidden="true">/</span>
        </div>
        <span className={`query-note ${parsed.error ? 'bad' : ''}`} id="query-note" role="status">
          {parsed.error ?? (set.status === 'ready' ? `${parsed.descriptor} · ${beforeStats.count} of ${rows * cols}` : '')}
        </span>

        <button
          type="button"
          className="btn small"
          aria-pressed={showDiff}
          onClick={onToggleDiff}
          aria-label={showDiff ? 'Hide the before and after diff' : 'Show the before and after diff'}
          title="Toggle before/after (d)"
        >
          Diff {showDiff ? 'on' : 'off'}
        </button>
        {premise ? (
          <button type="button" className="btn small ghost" onClick={onExitPreview} aria-label="Exit the retraction preview">
            Exit preview
          </button>
        ) : null}
      </div>

      {set.status === 'ready' && !busy ? (
        <div className="stats-row">
          <StatCard label="cells" value={String(beforeStats.count)} />
          <StatCard label="min" value={formatValue(beforeStats.min, 3)} />
          <StatCard label="max" value={formatValue(beforeStats.max, 3)} />
          <StatCard label="mean" value={formatValue(beforeStats.mean, 4)} delta={showDiff ? statsDelta.mean : undefined} />
          <StatCard label="std" value={formatValue(beforeStats.std, 4)} />
          <StatCard label="|w| max" value={formatValue(beforeStats.maxAbs, 3)} delta={showDiff ? statsDelta.maxAbs : undefined} />
          <StatCard label="L2" value={formatValue(beforeStats.l2, 3)} delta={showDiff ? statsDelta.l2 : undefined} />
          <StatCard label="zeros" value={String(beforeStats.zeros)} />
        </div>
      ) : null}

      {body()}

      {set.status === 'ready' && !busy ? (
        <div className="cell-detail" aria-live="off">
          {selectedCell ? (
            <>
              <span className="cd-item"><span className="cd-k">cell</span><span>{cellLabel(selectedCell.r, selectedCell.c)}</span></span>
              <span className="cd-item"><span className="cd-k">value</span><span>{selectedValue !== undefined ? formatValue(selectedValue) : '—'}</span></span>
              {showDiff && selectedDelta !== undefined ? (
                <span className="cd-item">
                  <span className="cd-k">after</span>
                  <span>{selectedAfter !== undefined ? formatValue(selectedAfter) : '—'}</span>
                  <span className={selectedDelta > 0 ? 'mono' : 'mono'} style={{ color: 'var(--amber)' }}>
                    (premise added {formatDelta(selectedDelta)})
                  </span>
                </span>
              ) : null}
              <span className="cd-item">
                <span className="cd-k">premises</span>
                <span>
                  {selectedPremises.length
                    ? selectedPremises.map((p) => p.id).join(' · ')
                    : 'none contributed to this cell'}
                </span>
              </span>
              <button type="button" className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => onSelectCell(null)}>
                Clear selection
              </button>
            </>
          ) : (
            <span className="muted">
              Click a cell, or focus the grid and press Enter. {diffRows.length && showDiff ? `${diffRows.length} cells change under this preview.` : ''}
            </span>
          )}
        </div>
      ) : null}

      {staged ? (
        <div className="notice amber" style={{ margin: '10px 12px 12px' }} role="status">
          <div>
            <div className="notice-title">Staged preview</div>
            <div>
              This patch is held in the editor only. The committed tensor, its hash and every
              downstream reader still see the original values.
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
