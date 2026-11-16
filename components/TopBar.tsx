interface TopBarProps {
  committedHash: string;
  previewHash: string | null;
  previewLabel: string | null;
  staged: boolean;
  canUndo: boolean;
  historyLength: number;
  onCopyHash: () => void;
  onUndo: () => void;
  onExitPreview: () => void;
  onOpenShortcuts: () => void;
}

export function TopBar({
  committedHash,
  previewHash,
  previewLabel,
  staged,
  canUndo,
  historyLength,
  onCopyHash,
  onUndo,
  onExitPreview,
  onOpenShortcuts,
}: TopBarProps) {
  const hash = previewHash ?? committedHash;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">W</span>
        <span>
          <span className="brand-name">Wide IDE</span>
          <span className="brand-sub" style={{ marginLeft: 10 }}>
            idol-xl · block 4 · weights are values
          </span>
        </span>
      </div>

      <div className="topbar-spacer" />

      {previewLabel ? (
        <span className={`chip ${staged ? 'amber' : 'accent'}`} title={staged ? 'Preview staged in the editor. No model state has been written.' : 'Previewing a retraction. Model state unchanged.'}>
          <span className="dot" aria-hidden="true" />
          {staged ? 'staged (not committed)' : `preview · ${previewLabel}`}
        </span>
      ) : (
        <span className="chip" title="No retraction is being previewed">
          <span className="dot" aria-hidden="true" style={{ background: 'var(--ink-3)' }} />
          model state · committed
        </span>
      )}

      <div className={`hash-block${previewHash ? ' dirty' : ''}`}>
        <span className="hash-label">{previewHash ? 'preview' : 'state'}</span>
        <span className="hash-value mono" aria-label={`State hash ${hash}`}>{hash}</span>
        <button
          type="button"
          className="btn small ghost"
          onClick={onCopyHash}
          aria-label="Copy state hash to the clipboard"
        >
          Copy
        </button>
      </div>

      <button
        type="button"
        className="btn small"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={`Undo preview action${historyLength ? `, ${historyLength} in the stack` : ''}`}
        title="Undo the last preview action (⌘Z / Ctrl+Z)"
      >
        Undo preview {historyLength > 0 ? <span className="kbd">{historyLength}</span> : null}
      </button>

      {previewLabel ? (
        <button type="button" className="btn small ghost" onClick={onExitPreview} aria-label="Exit retraction preview">
          Exit preview
        </button>
      ) : null}

      <button type="button" className="btn small ghost" onClick={onOpenShortcuts} aria-label="Show keyboard shortcuts" title="Keyboard shortcuts (?)">
        <span className="kbd">?</span>
      </button>
    </header>
  );
}
