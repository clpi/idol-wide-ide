'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LineagePane } from '../components/LineagePane';
import { ProgramPane } from '../components/ProgramPane';
import { ShortcutDialog } from '../components/ShortcutDialog';
import { TensorInspector } from '../components/TensorInspector';
import { TopBar } from '../components/TopBar';
import { VersionTimeline } from '../components/VersionTimeline';
import { parseQuery, previewValues, stateHash, diffRows as computeDiffRows } from '../lib/derive';
import { fnv1a64, groupHash } from '../lib/hash';
import { PREMISES, PREMISE_BY_ID } from '../lib/mock/premises';
import { VERSION_BY_ID, VERSIONS, CURRENT_VERSION_ID } from '../lib/mock/versions';
import {
  buildRecoveredFc2,
  DEFAULT_TENSOR_ID,
  WEIGHT_SETS,
  WEIGHT_SET_BY_ID,
} from '../lib/mock/weightSets';
import type { TensorId, WeightSet } from '../lib/types';

type PreviewState = {
  premiseId: string | null;
  diff: boolean;
  staged: boolean;
};

const EMPTY_PREVIEW: PreviewState = { premiseId: null, diff: true, staged: false };
const BOOT_MS = 700;
const LOAD_MS = 420;
const RETRY_MS = 900;

type PaneId = 'program' | 'tensor' | 'lineage';

export default function WorkspacePage() {
  /* ---------- workspace state ---------- */
  const [booting, setBooting] = useState(true);
  const [selectedTensorId, setSelectedTensorId] = useState<TensorId>(DEFAULT_TENSOR_ID);
  const [loadingTensorId, setLoadingTensorId] = useState<TensorId | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(CURRENT_VERSION_ID);
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);
  const [history, setHistory] = useState<PreviewState[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [filterToTensor, setFilterToTensor] = useState(false);
  const [recovered, setRecovered] = useState<Record<string, number[][]>>({});
  const [recovering, setRecovering] = useState(false);
  const [activePane, setActivePane] = useState<PaneId>('tensor');

  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const announce = useCallback((text: string) => {
    setAnnouncement((prev) => ({ id: prev.id + 1, text }));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setBooting(false);
      announce('Workspace ready. Five surfaces, eleven premises, version v46.');
    }, BOOT_MS);
    timers.current.push(t);
    return () => window.clearTimeout(t);
  }, [announce]);

  /* ---------- derived workspace ---------- */
  const rawSet = WEIGHT_SET_BY_ID[selectedTensorId] ?? WEIGHT_SETS[0];
  const recoveredValues = recovered[rawSet.id];

  const set: WeightSet = useMemo(
    () => (recoveredValues
      ? { ...rawSet, values: recoveredValues, status: 'ready' as const, statusDetail: undefined }
      : rawSet),
    [rawSet, recoveredValues],
  );

  const version = VERSION_BY_ID[selectedVersionId] ?? VERSIONS[VERSIONS.length - 1];
  const premise = preview.premiseId ? PREMISE_BY_ID[preview.premiseId] ?? null : null;

  const { values: after, deltas } = useMemo(() => previewValues(set, premise), [set, premise]);
  const rows = useMemo(() => computeDiffRows(set, premise), [set, premise]);
  const parsed = useMemo(() => parseQuery(query, set.values), [query, set.values]);

  const committedHash = useMemo(() => stateHash(set.values, set.premiseIds), [set]);
  const previewHash = useMemo(() => {
    if (!premise) return null;
    const touches = premise.deltas.some((d) => d.tensor === set.id);
    const ids = touches ? set.premiseIds.filter((id) => id !== premise.id) : set.premiseIds;
    return stateHash(after, ids);
  }, [after, premise, set.id, set.premiseIds]);

  const versionHashes = useMemo(
    () => Object.fromEntries(VERSIONS.map((v) => [v.id, fnv1a64(`${v.id}|${v.summary}|${v.premiseIds.join(',')}`)])),
    [],
  );

  const displayHash = previewHash ?? committedHash;

  /* ---------- preview actions (editor state only) ---------- */
  const pushPreview = useCallback((next: PreviewState) => {
    setHistory((h) => [...h, preview]);
    setPreview(next);
  }, [preview]);

  const selectPremise = useCallback((id: string) => {
    if (preview.premiseId === id) {
      setHistory((h) => [...h, preview]);
      setPreview(EMPTY_PREVIEW);
      announce(`Preview cleared for ${id}. Model state unchanged.`);
      return;
    }
    const next = { premiseId: id, diff: true, staged: false };
    pushPreview(next);
    const p = PREMISE_BY_ID[id];
    announce(p
      ? `Previewing retraction of ${id} (${p.label}). ${p.deltas.length} cells affected across the workspace.`
      : `Previewing ${id}.`);
  }, [preview, pushPreview, announce]);

  const exitPreview = useCallback(() => {
    if (!preview.premiseId) return;
    setHistory((h) => [...h, preview]);
    setPreview(EMPTY_PREVIEW);
    announce('Preview exited. The committed state was never modified.');
  }, [preview, announce]);

  const toggleDiff = useCallback(() => {
    if (!preview.premiseId) {
      announce('Select a premise in the lineage panel to see a before and after diff.');
      return;
    }
    pushPreview({ ...preview, diff: !preview.diff });
    announce(preview.diff ? 'Diff hidden. Affected cells stay highlighted.' : 'Diff shown: each affected cell lists its value before and after retraction.');
  }, [preview, pushPreview, announce]);

  const stage = useCallback(() => {
    if (!preview.premiseId) return;
    pushPreview({ ...preview, staged: true });
    announce('Preview staged in the editor. Nothing has been written to the model.');
  }, [preview, pushPreview, announce]);

  const unstage = useCallback(() => {
    pushPreview({ ...preview, staged: false });
    announce('Preview unstaged. It is a preview again.');
  }, [preview, pushPreview, announce]);

  const undo = useCallback(() => {
    if (!history.length) {
      announce('Nothing to undo.');
      return;
    }
    const next = history[history.length - 1];
    setPreview(next);
    setHistory(history.slice(0, -1));
    announce(next.premiseId ? `Reverted to preview of ${next.premiseId}.` : 'Reverted to no preview.');
  }, [history, announce]);

  /* ---------- navigation ---------- */
  const selectTensor = useCallback((id: TensorId) => {
    if (id === selectedTensorId && !loadingTensorId) return;
    setLoadingTensorId(id);
    setSelectedCell(null);
    const t = window.setTimeout(() => {
      setSelectedTensorId(id);
      setLoadingTensorId(null);
      const target = WEIGHT_SET_BY_ID[id];
      announce(`Opened ${target?.name ?? id}. ${target?.status === 'ready' ? `${target.shape[0]} by ${target.shape[1]} cells.` : target?.status === 'error' ? 'This shard failed to load.' : 'This surface has no cells.'}`);
    }, LOAD_MS);
    timers.current.push(t);
  }, [selectedTensorId, loadingTensorId, announce]);

  const cycleTensor = useCallback((dir: number) => {
    const idx = WEIGHT_SETS.findIndex((s) => s.id === selectedTensorId);
    const next = WEIGHT_SETS[(idx + dir + WEIGHT_SETS.length) % WEIGHT_SETS.length];
    selectTensor(next.id);
  }, [selectedTensorId, selectTensor]);

  const cyclePremise = useCallback((dir: number) => {
    const list = filterToTensor
      ? PREMISES.filter((p) => p.tensorIds.includes(selectedTensorId))
      : PREMISES;
    if (!list.length) return;
    const idx = list.findIndex((p) => p.id === preview.premiseId);
    const next = list[(idx + dir + list.length) % list.length];
    selectPremise(next.id);
  }, [filterToTensor, selectedTensorId, preview.premiseId, selectPremise]);

  const retry = useCallback(() => {
    setRecovering(true);
    announce('Retrying the shard. This is a simulated reconnect.');
    const t = window.setTimeout(() => {
      setRecovered((r) => ({ ...r, fc2: buildRecoveredFc2() }));
      setRecovering(false);
      announce('Shard reconnected with generated cells. The recovery is simulated; no network call was made.');
    }, RETRY_MS);
    timers.current.push(t);
  }, [announce]);

  const copyHash = useCallback(() => {
    const value = groupHash(displayHash);
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard) {
      announce(`State hash ${displayHash}. Clipboard is unavailable in this browser.`);
      return;
    }
    clipboard.writeText(displayHash)
      .then(() => announce(`Copied state hash ${displayHash}.`))
      .catch(() => announce(`Could not copy. State hash is ${displayHash}.`));
  }, [displayHash, announce]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      if (e.key === 'Escape') {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (typing) { el?.blur(); setQuery(''); return; }
        if (preview.premiseId) { exitPreview(); return; }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('tensor-search')?.focus();
        return;
      }
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }
      if (e.key.toLowerCase() === 'd') { e.preventDefault(); toggleDiff(); return; }
      if (e.key === '[') { e.preventDefault(); cycleTensor(-1); return; }
      if (e.key === ']') { e.preventDefault(); cycleTensor(1); return; }
      if (e.key === 'j') { e.preventDefault(); cyclePremise(1); return; }
      if (e.key === 'k') { e.preventDefault(); cyclePremise(-1); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview.premiseId, shortcutsOpen, exitPreview, undo, toggleDiff, cycleTensor, cyclePremise]);

  /* ---------- render ---------- */
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to the tensor inspector</a>

      <TopBar
        committedHash={groupHash(committedHash)}
        previewHash={previewHash ? groupHash(previewHash) : null}
        previewLabel={premise ? `${premise.id} · ${premise.label}` : null}
        staged={preview.staged}
        canUndo={history.length > 0}
        historyLength={history.length}
        onCopyHash={copyHash}
        onUndo={undo}
        onExitPreview={exitPreview}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <VersionTimeline
        versions={VERSIONS}
        selectedId={selectedVersionId}
        hashes={versionHashes}
        onSelect={(id) => {
          setSelectedVersionId(id);
          const v = VERSION_BY_ID[id];
          announce(`Viewing ${v.label}: ${v.summary}. Read-only.`);
        }}
      />

      <div className="pane-tabs" role="tablist" aria-label="Workspace panes">
        {(['program', 'tensor', 'lineage'] as PaneId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="pane-tab"
            aria-selected={activePane === id}
            onClick={() => setActivePane(id)}
          >
            {id === 'program' ? 'Program' : id === 'tensor' ? 'Tensor' : 'Lineage'}
          </button>
        ))}
      </div>

      <main id="main" className="panes">
        <ProgramPane
            sets={WEIGHT_SETS}
            selectedId={selectedTensorId}
            onSelect={selectTensor}
            loadingId={loadingTensorId}
          recoveredIds={Object.keys(recovered)}
          active={activePane === 'program'}
        />
        <TensorInspector
            set={set}
            booting={booting}
            loading={loadingTensorId !== null}
            recovering={recovering}
            onRetry={retry}
            premise={premise}
            diff={preview.diff}
            staged={preview.staged}
            after={after}
            deltas={deltas}
            query={query}
            onQueryChange={setQuery}
            parsed={parsed}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            premises={PREMISES}
            onToggleDiff={toggleDiff}
            onExitPreview={exitPreview}
          diffRows={rows}
          active={activePane === 'tensor'}
        />
        <LineagePane
            premises={PREMISES}
            byId={PREMISE_BY_ID}
            selectedId={preview.premiseId}
            onSelect={selectPremise}
            tensorId={selectedTensorId}
            tensorName={set.name}
            version={version}
            filterToTensor={filterToTensor}
            onToggleFilter={() => {
              setFilterToTensor((v) => !v);
              announce(filterToTensor ? 'Showing all premises.' : `Showing only premises that touch ${set.name}.`);
            }}
            staged={preview.staged}
            onStage={stage}
            onUnstage={unstage}
            onExitPreview={exitPreview}
            previewActive={Boolean(preview.premiseId)}
            booting={booting}
          diffRows={rows}
          active={activePane === 'lineage'}
        />
      </main>

      <footer className="statusbar">
        <span className="sb-item"><span className="sb-dot" aria-hidden="true" /> mock workspace · deterministic seeds</span>
        <span className="sb-item">state {committedHash}</span>
        {previewHash ? <span className="sb-item" style={{ color: 'var(--amber)' }}>preview {previewHash}</span> : null}
        <span className="sb-item" style={{ marginLeft: 'auto' }}>hash = FNV-1a 64 over cells + premise ids · display only</span>
        <span className="sb-item">v46 · read-only</span>
      </footer>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement.id > 0 ? announcement.text : ''}
      </div>

      <ShortcutDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
