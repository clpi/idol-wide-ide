'use client';

import { useMemo, useState } from 'react';
import type { TensorId, WeightSet } from '../lib/types';

interface ProgramPaneProps {
  sets: readonly WeightSet[];
  selectedId: TensorId;
  onSelect: (id: TensorId) => void;
  loadingId: string | null;
  recoveredIds: readonly string[];
  active: boolean;
}

const KEYWORDS = new Set([
  'tensor', 'bind', 'derive', 'constrain', 'objective', 'observe', 'calibrate',
  'assert', 'retract', 'steps', 'lr', 'bs', 'state', 'frozen', 'route', 'load',
  'cells', 'nothing', 'mod', 'per', 'row', 'sum',
]);

function highlightLine(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = line;
  let comment = '';
  const hash = line.indexOf('#');
  if (hash >= 0) {
    rest = line.slice(0, hash);
    comment = line.slice(hash);
    // keep the comment aligned with the original spacing
    const pad = rest.length;
    comment = ' '.repeat(0) + comment;
    rest = rest.padEnd(pad, ' ');
  }
  const re = /([A-Za-z_][A-Za-z0-9_.]*)|(\d[\d_.eE+-]*)|(<[-=]|->|>=|<=|=|\|)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(rest)) !== null) {
    if (m.index > last) out.push(<span key={`p${key++}`}>{rest.slice(last, m.index)}</span>);
    const [text, word, num, op] = m;
    if (word) {
      const isKw = KEYWORDS.has(word);
      out.push(
        <span key={`t${key++}`} className={isKw ? 'tok-key' : word.startsWith('pm-') ? 'tok-pre' : undefined}>
          {text}
        </span>,
      );
    } else if (num) {
      out.push(<span key={`n${key++}`} className="tok-num">{text}</span>);
    } else if (op) {
      out.push(<span key={`o${key++}`} className="tok-op">{text}</span>);
    }
    last = m.index + text.length;
  }
  if (last < rest.length) out.push(<span key={`p${key++}`}>{rest.slice(last)}</span>);
  if (comment) out.push(<span key="c" className="tok-com">{comment}</span>);
  return out;
}

export function ProgramPane({ sets, selectedId, onSelect, loadingId, recoveredIds, active }: ProgramPaneProps) {
  const [filter, setFilter] = useState('');
  const selected = sets.find((s) => s.id === selectedId) ?? sets[0];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.status.includes(q) ||
        s.premiseIds.some((id) => id.includes(q)),
    );
  }, [sets, filter]);

  return (
    <section className="pane pane-program" aria-labelledby="program-heading" data-active={active ? 'true' : 'false'}>
      <div className="pane-head">
        <h2 className="pane-title" id="program-heading">Program &amp; weights</h2>
        <span className="pane-meta">{sets.length} surfaces</span>
      </div>
      <div className="pane-body">
        <div className="code-card">
          <div className="code-card-head">
            <span className="tag">block-4.idol</span>
            <span style={{ marginLeft: 'auto' }}>{selected.snippet.caption}</span>
          </div>
          <pre className="code" aria-label={`Weight program for ${selected.name}`}>
            {selected.snippet.lines.map((line, i) => (
              <div className="code-line" key={i}>
                <span className="ln" aria-hidden="true">{i + 1}</span>
                <span className="ct">{highlightLine(line)}</span>
              </div>
            ))}
          </pre>
        </div>

        <div className="section-label">Weight sets</div>

        <div className="list-search">
          <span aria-hidden="true" style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>⌕</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter by name, role or premise"
            aria-label="Filter weight sets"
          />
          {filter ? (
            <button type="button" className="btn small ghost" onClick={() => setFilter('')} aria-label="Clear weight set filter">
              ✕
            </button>
          ) : null}
        </div>

        <div className="tensor-list" role="listbox" aria-label="Weight sets" aria-orientation="vertical">
          {filtered.map((set) => {
            const isLoading = loadingId === set.id;
            const recovered = recoveredIds.includes(set.id);
            return (
              <button
                key={set.id}
                type="button"
                role="option"
                aria-selected={set.id === selectedId}
                className="tensor-item"
                onClick={() => onSelect(set.id)}
                aria-label={`${set.name}, ${set.role}, ${set.status === 'ready' ? `${set.shape[0]} by ${set.shape[1]} cells` : set.status}`}
              >
                <span className={`status-dot ${isLoading ? 'loading' : set.status}`} aria-hidden="true" />
                <span>
                  <span className="ti-name">{set.name}</span>
                  <span className="ti-sub" style={{ display: 'block' }}>
                    {set.role}
                    {recovered ? ' · recovered' : ''}
                  </span>
                </span>
                <span className="ti-right">
                  {set.status === 'ready' ? `${set.shape[0]}×${set.shape[1]}` : set.status}
                  <br />
                  {set.premiseIds.length ? `${set.premiseIds.length}p` : '—'}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div className="state-card" style={{ padding: '14px 10px' }}>
              <h4>No surfaces match</h4>
              <p>Nothing in this workspace matches “{filter}”.</p>
              <button type="button" className="btn small" onClick={() => setFilter('')}>Clear filter</button>
            </div>
          ) : null}
        </div>

        <div className="section-label">How this pane works</div>
        <p className="muted" style={{ fontSize: 11.5, margin: '0 0 4px' }}>
          The program is the readable form of the same state the inspector shows. Selecting a
          surface here retargets the inspector and the lineage panel; nothing is executed.
        </p>
      </div>
    </section>
  );
}
