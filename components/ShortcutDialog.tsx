import { useEffect, useRef } from 'react';

interface ShortcutDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: [string, string][] = [
  ['/ ', 'Focus the cell search field'],
  ['↑ ↓ ← →', 'Move between tensor cells'],
  ['Enter', 'Select the focused cell (lock it into the detail bar)'],
  ['d', 'Toggle before/after diff while a premise is previewed'],
  ['j / k', 'Next / previous premise in the lineage panel'],
  ['[ / ]', 'Previous / next weight set'],
  ['⌘Z / Ctrl+Z', 'Undo the last preview action'],
  ['Esc', 'Close the dialog, clear search, or exit preview'],
  ['?', 'This dialog'],
];

export function ShortcutDialog({ open, onClose }: ShortcutDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 id="shortcuts-title">Keyboard</h2>
          <button ref={closeRef} type="button" className="btn small ghost" onClick={onClose} aria-label="Close keyboard shortcuts">
            Esc
          </button>
        </header>
        <div className="dialog-body">
          <dl className="shortcut-grid">
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys} style={{ display: 'contents' }}>
                <dt><kbd>{keys}</kbd></dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
