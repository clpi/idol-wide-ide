'use client';

import { useMemo } from 'react';
import {
  ancestorChain,
  deltasFor,
  formatDelta,
  formatValue,
  premiseDepth,
  type DiffRow,
} from '../lib/derive';
import type { Premise, TensorId, Version } from '../lib/types';

interface LineagePaneProps {
  premises: readonly Premise[];
  byId: Record<string, Premise>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  tensorId: TensorId;
  tensorName: string;
  version: Version;
  filterToTensor: boolean;
  onToggleFilter: () => void;
  staged: boolean;
  onStage: () => void;
  onUnstage: () => void;
  onExitPreview: () => void;
  previewActive: boolean;
  booting: boolean;
  diffRows: DiffRow[];
  active: boolean;
}

export function LineagePane({
  premises,
  byId,
  selectedId,
  onSelect,
  tensorId,
  tensorName,
  version,
  filterToTensor,
  onToggleFilter,
  staged,
  onStage,
  onUnstage,
  onExitPreview,
  previewActive,
  booting,
  diffRows,
  active,
}: LineagePaneProps) {
  const selected = selectedId ? byId[selectedId] ?? null : null;

  const rows = useMemo(() => {
    const base = premises.filter((p) => !filterToTensor || p.tensorIds.includes(tensorId));
    return base.map((p) => ({
      premise: p,
      depth: premiseDepth(p, byId),
      inVersion: version.premiseIds.includes(p.id),
      touchCount: deltasFor(p, tensorId).length,
    }));
  }, [premises, filterToTensor, tensorId, byId, version.premiseIds]);

  const chain = selected ? ancestorChain(selected, byId) : [];
  const touch = selected ? deltasFor(selected, tensorId) : [];
  const maxDelta = touch.reduce((m, d) => Math.max(m, Math.abs(d.delta)), 0);

  return (
    <section className="pane pane-lineage" aria-labelledby="lineage-heading" data-active={active ? 'true' : 'false'}>
      <div className="pane-head">
        <h2 className="pane-title" id="lineage-heading">Premise lineage</h2>
        <span className="pane-meta">{rows.length} / {premises.length}</span>
      </div>
      <div className="pane-body">
        <button
          type="button"
          className="btn small ghost"
          aria-pressed={filterToTensor}
          onClick={onToggleFilter}
          aria-label={`Show only premises that contribute to ${tensorName}`}
          style={{ marginBottom: 8 }}
        >
          {filterToTensor ? `Only ${tensorName}` : 'All surfaces'}
        </button>

        {booting ? (
          <div aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ padding: '6px 2px' }}>
                <div className="skeleton sk-line" style={{ width: `${68 - (i % 3) * 9}%` }} />
                <div className="skeleton sk-line" style={{ width: '42%', height: 7 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="premise-list" role="listbox" aria-label="Premises">
            {rows.map(({ premise, depth, inVersion, touchCount }) => (
              <button
                key={premise.id}
                type="button"
                role="option"
                aria-selected={premise.id === selectedId}
                className={`premise-row${inVersion ? '' : ' outside-version'}`}
                style={{ paddingLeft: 9 + depth * 12 }}
                onClick={() => onSelect(premise.id)}
                aria-label={`${premise.id}, ${premise.label}, ${premise.kind}, confidence ${Math.round(premise.confidence * 100)} percent${inVersion ? '' : `, not present in ${version.label}`}${touchCount ? `, ${touchCount} cells in ${tensorName}` : ''}`}
              >
                <span>
                  <span className="pr-name">{premise.id}</span>{' '}
                  <span style={{ fontSize: 11.5 }}>{premise.label}</span>
                  {premise.retractable ? null : <span title="Owned outside this workspace" aria-hidden="true"> 🔒</span>}
                </span>
                <span className="pr-right">
                  <span className={`kind ${premise.kind}`}>{premise.kind}</span>
                </span>
                <span className="pr-sub">
                  {premise.statement.length > 92 ? `${premise.statement.slice(0, 92)}…` : premise.statement}
                </span>
                <span className="pr-sub" style={{ color: inVersion ? 'var(--ink-3)' : 'var(--amber)' }}>
                  {inVersion ? premise.collector : `not in ${version.label} · ${premise.collector}`}
                  {touchCount ? ` · ${touchCount} cells here` : ''}
                </span>
              </button>
            ))}
            {rows.length === 0 ? (
              <div className="state-card">
                <h4>No premises touch {tensorName}</h4>
                <p>This surface has no tracked contributions, so there is nothing to retract.</p>
                <button type="button" className="btn small" onClick={onToggleFilter}>Show all surfaces</button>
              </div>
            ) : null}
          </div>
        )}

        {selected ? (
          <div className="detail-card" aria-live="polite">
            <h3>
              {selected.id} · {selected.label}
            </h3>
            <p>{selected.statement}</p>

            {!version.premiseIds.includes(selected.id) ? (
              <div className="notice amber" style={{ margin: '0 0 8px', fontSize: 11.5 }}>
                <div>
                  This premise did not exist at <strong>{version.label}</strong>. Previewing it here
                  describes the current workspace, not that recorded state.
                </div>
              </div>
            ) : null}

            <dl className="kv">
              <dt>kind</dt><dd>{selected.kind}</dd>
              <dt>collector</dt><dd>{selected.collector}</dd>
              <dt>captured</dt><dd>{new Date(selected.capturedAt).toLocaleString()}</dd>
              <dt>confidence</dt><dd>{Math.round(selected.confidence * 100)}%</dd>
              <dt>retractable</dt><dd>{selected.retractable ? 'yes, in this workspace' : 'no, owned elsewhere'}</dd>
              <dt>cells here</dt>
              <dd>{touch.length ? `${touch.length} · max |Δ| ${formatValue(maxDelta, 4)}` : `none in ${tensorName}`}</dd>
            </dl>

            <div className="lineage-chain" aria-label="Lineage chain">
              {chain.map((node, i) => (
                <span key={node.id} style={{ display: 'contents' }}>
                  {i > 0 ? <span className="arrow" aria-hidden="true">→</span> : null}
                  <span className={`node${node.id === selected.id ? ' current' : ''}`}>{node.id}</span>
                </span>
              ))}
            </div>

            {diffRows.length ? (
              <table className="diff-table">
                <caption className="sr-only">Cells changed in {tensorName} if this premise is retracted</caption>
                <thead>
                  <tr>
                    <th scope="col">cell</th>
                    <th scope="col">now</th>
                    <th scope="col">after</th>
                    <th scope="col">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((row) => (
                    <tr key={`${row.r}-${row.c}`}>
                      <td>r{row.r}c{row.c}</td>
                      <td>{formatValue(row.before)}</td>
                      <td>{formatValue(row.after)}</td>
                      <td className={row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : ''}>{formatDelta(row.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {selected.retractable ? (
              <div className="notice-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={`btn small ${previewActive ? 'ghost' : 'primary'}`}
                  onClick={previewActive ? onExitPreview : () => onSelect(selected.id)}
                  aria-label={previewActive ? 'Exit the retraction preview' : `Preview retracting ${selected.id}`}
                >
                  {previewActive ? 'Exit preview' : 'Preview retraction'}
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={staged ? onUnstage : onStage}
                  aria-pressed={staged}
                  aria-label={staged ? 'Unstage the preview' : 'Stage the preview in the editor'}
                  title="Staging keeps the change in the editor only; no model state is written"
                >
                  {staged ? 'Unstage' : 'Stage preview'}
                </button>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 11.5, margin: '8px 0 0' }}>
                This premise is owned by <code className="code-inline">{selected.collector}</code>, outside
                this workspace. Retraction would have to be requested from the owning pipeline; the
                editor will not fake it.
              </p>
            )}
          </div>
        ) : (
          <div className="detail-card" style={{ borderStyle: 'dashed' }}>
            <h3>No premise selected</h3>
            <p style={{ marginBottom: 0 }}>
              Select a premise to highlight the cells it touched and to preview what retracting it
              would do. The preview never writes to the tensor.
            </p>
          </div>
        )}

        <div className="section-label">Reading the lineage</div>
        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
          Indentation follows first-parent derivation: <code className="code-inline">pm-07</code> was
          derived from <code className="code-inline">pm-01</code> and{' '}
          <code className="code-inline">pm-02</code>, so it sits under them. Selecting a premise
          previews its withdrawal; it never mutates the workspace, and any record of the action would
          have to be a new version.
        </p>
      </div>
    </section>
  );
}
